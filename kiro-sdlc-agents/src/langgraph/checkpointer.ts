/**
 * WorkspaceCheckpointer — KSA-210
 * Persists LangGraph checkpoint state to workspace JSON files.
 * Implements atomic writes (tmp+rename), cleanup, and security sanitization.
 */

import * as path from "path";
import * as fs from "fs";
import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
} from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { PersistedPipelineInfo } from "./state";

/** Sensitive field patterns — stripped before persistence (BR-10) */
const SENSITIVE_PATTERNS = [/token/i, /key/i, /secret/i, /password/i, /credential/i];

/** Maximum persisted pipelines per workspace */
const MAX_PIPELINES = 10;

/** Completed pipeline retention (days) */
const RETENTION_DAYS = 7;

// Re-export type for internal use
interface CheckpointTuple {
  config: RunnableConfig;
  checkpoint: Checkpoint;
  metadata?: CheckpointMetadata;
  parentConfig?: RunnableConfig;
}

type ChannelVersions = Record<string, number | string>;
type PendingWrite = [string, unknown];

export class WorkspaceCheckpointer extends BaseCheckpointSaver {
  private readonly stateDir: string;

  constructor(workspaceRoot: string) {
    super();
    this.stateDir = path.join(workspaceRoot, ".vscode", "kiro-pipeline-state");
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) { return undefined; }

    const filePath = path.join(this.stateDir, `${threadId}.json`);
    if (!fs.existsSync(filePath)) { return undefined; }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return {
        config,
        checkpoint: data.graphCheckpoint,
        metadata: data.state || {},
      };
    } catch {
      return undefined;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) { throw new Error("thread_id required for checkpoint persistence"); }

    this.ensureDir();

    const filePath = path.join(this.stateDir, `${threadId}.json`);
    const tmpPath = filePath + ".tmp";

    let createdAt = new Date().toISOString();
    if (fs.existsSync(filePath)) {
      try {
        createdAt = JSON.parse(fs.readFileSync(filePath, "utf-8")).createdAt || createdAt;
      } catch { /* use new timestamp */ }
    }

    const data = {
      version: 1,
      schemaVersion: "1.0.0",
      graphCheckpoint: checkpoint,
      state: this.sanitizeMetadata(metadata),
      createdAt,
      lastModified: new Date().toISOString(),
    };

    // Atomic write: write to tmp then rename
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);

    return config;
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    _taskId: string
  ): Promise<void> {
    // LangGraph calls putWrites for intermediate channel writes.
    // For our file-based checkpointer, we store them alongside the checkpoint.
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) { return; }

    const filePath = path.join(this.stateDir, `${threadId}.json`);
    if (!fs.existsSync(filePath)) { return; }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (!data.pendingWrites) { data.pendingWrites = []; }
      data.pendingWrites.push(...writes);
      data.lastModified = new Date().toISOString();
      const tmpPath = filePath + ".tmp";
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tmpPath, filePath);
    } catch {
      // Non-critical — full checkpoint via put() is the source of truth
    }
  }

  async *list(
    config: RunnableConfig,
    _options?: { limit?: number; before?: RunnableConfig; filter?: Record<string, unknown> }
  ): AsyncGenerator<CheckpointTuple> {
    if (!fs.existsSync(this.stateDir)) { return; }

    const files = fs.readdirSync(this.stateDir).filter(f => f.endsWith(".json") && !f.endsWith(".tmp"));

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.stateDir, file), "utf-8"));
        const threadId = file.replace(".json", "");
        yield {
          config: { configurable: { thread_id: threadId } },
          checkpoint: data.graphCheckpoint,
          metadata: data.state || {},
        };
      } catch {
        // Skip corrupted files
      }
    }
  }

  async delete(config: RunnableConfig): Promise<void> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) { return; }

    const filePath = path.join(this.stateDir, `${threadId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /** List all persisted pipelines for resume UI */
  listPersistedPipelines(): PersistedPipelineInfo[] {
    if (!fs.existsSync(this.stateDir)) { return []; }

    const pipelines: PersistedPipelineInfo[] = [];
    const files = fs.readdirSync(this.stateDir).filter(f => f.endsWith(".json") && !f.endsWith(".tmp"));

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.stateDir, file), "utf-8"));
        const state = data.state || {};
        pipelines.push({
          threadId: file.replace(".json", ""),
          ticketKey: state.ticketKey || "unknown",
          phase: state.currentPhase || "requirements",
          status: state.pipelineStatus || "idle",
          lastUpdatedAt: data.lastModified || "",
        });
      } catch {
        // Skip corrupted files
      }
    }

    return pipelines.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
  }

  /** Remove pipelines older than maxAgeDays */
  cleanup(maxAgeDays: number = RETENTION_DAYS): void {
    if (!fs.existsSync(this.stateDir)) { return; }

    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(this.stateDir).filter(f => f.endsWith(".json") && !f.endsWith(".tmp"));

    for (const file of files) {
      try {
        const filePath = path.join(this.stateDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const modified = new Date(data.lastModified || 0).getTime();
        if (data.state?.pipelineStatus === "completed" && modified < cutoff) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Skip
      }
    }

    this.enforceMaxPipelines();
  }

  private enforceMaxPipelines(): void {
    const pipelines = this.listPersistedPipelines();
    if (pipelines.length <= MAX_PIPELINES) { return; }

    const completed = pipelines
      .filter(p => p.status === "completed")
      .sort((a, b) => a.lastUpdatedAt.localeCompare(b.lastUpdatedAt));

    let toRemove = pipelines.length - MAX_PIPELINES;
    for (const p of completed) {
      if (toRemove <= 0) { break; }
      const filePath = path.join(this.stateDir, `${p.threadId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        toRemove--;
      }
    }
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  /** Strip sensitive metadata fields before persistence */
  private sanitizeMetadata(metadata: CheckpointMetadata): CheckpointMetadata {
    if (!metadata || typeof metadata !== "object") { return metadata; }

    const sanitized = structuredClone(metadata) as Record<string, unknown>;
    this.deepSanitize(sanitized);
    return sanitized as CheckpointMetadata;
  }

  private deepSanitize(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
        delete obj[key];
      } else if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        this.deepSanitize(obj[key] as Record<string, unknown>);
      }
    }
  }
}
