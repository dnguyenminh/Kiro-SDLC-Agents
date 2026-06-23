"use strict";
/**
 * WorkspaceCheckpointer — KSA-210
 * Persists LangGraph checkpoint state to workspace JSON files.
 * Implements atomic writes (tmp+rename), cleanup, and security sanitization.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceCheckpointer = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const langgraph_1 = require("@langchain/langgraph");
/** Sensitive field patterns — stripped before persistence (BR-10) */
const SENSITIVE_PATTERNS = [/token/i, /key/i, /secret/i, /password/i, /credential/i];
/** Maximum persisted pipelines per workspace */
const MAX_PIPELINES = 10;
/** Completed pipeline retention (days) */
const RETENTION_DAYS = 7;
class WorkspaceCheckpointer extends langgraph_1.BaseCheckpointSaver {
    stateDir;
    constructor(workspaceRoot) {
        super();
        this.stateDir = path.join(workspaceRoot, ".vscode", "kiro-pipeline-state");
    }
    async getTuple(config) {
        const threadId = config.configurable?.thread_id;
        if (!threadId) {
            return undefined;
        }
        const filePath = path.join(this.stateDir, `${threadId}.json`);
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        try {
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            return {
                config,
                checkpoint: data.graphCheckpoint,
                metadata: data.state || {},
            };
        }
        catch {
            return undefined;
        }
    }
    async put(config, checkpoint, metadata, _newVersions) {
        const threadId = config.configurable?.thread_id;
        if (!threadId) {
            throw new Error("thread_id required for checkpoint persistence");
        }
        this.ensureDir();
        const filePath = path.join(this.stateDir, `${threadId}.json`);
        const tmpPath = filePath + ".tmp";
        let createdAt = new Date().toISOString();
        if (fs.existsSync(filePath)) {
            try {
                createdAt = JSON.parse(fs.readFileSync(filePath, "utf-8")).createdAt || createdAt;
            }
            catch { /* use new timestamp */ }
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
    async putWrites(config, writes, _taskId) {
        // LangGraph calls putWrites for intermediate channel writes.
        // For our file-based checkpointer, we store them alongside the checkpoint.
        const threadId = config.configurable?.thread_id;
        if (!threadId) {
            return;
        }
        const filePath = path.join(this.stateDir, `${threadId}.json`);
        if (!fs.existsSync(filePath)) {
            return;
        }
        try {
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            if (!data.pendingWrites) {
                data.pendingWrites = [];
            }
            data.pendingWrites.push(...writes);
            data.lastModified = new Date().toISOString();
            const tmpPath = filePath + ".tmp";
            fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
            fs.renameSync(tmpPath, filePath);
        }
        catch {
            // Non-critical — full checkpoint via put() is the source of truth
        }
    }
    async *list(config, _options) {
        if (!fs.existsSync(this.stateDir)) {
            return;
        }
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
            }
            catch {
                // Skip corrupted files
            }
        }
    }
    async deleteThread(threadId) {
        if (!threadId) {
            return;
        }
        const filePath = path.join(this.stateDir, `${threadId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    async delete(config) {
        const threadId = config.configurable?.thread_id;
        if (threadId) {
            return this.deleteThread(threadId);
        }
    }
    /** List all persisted pipelines for resume UI */
    listPersistedPipelines() {
        if (!fs.existsSync(this.stateDir)) {
            return [];
        }
        const pipelines = [];
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
            }
            catch {
                // Skip corrupted files
            }
        }
        return pipelines.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
    }
    /** Remove pipelines older than maxAgeDays */
    cleanup(maxAgeDays = RETENTION_DAYS) {
        if (!fs.existsSync(this.stateDir)) {
            return;
        }
        const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        const tmpCutoff = Date.now() - 24 * 60 * 60 * 1000; // 1 day for orphaned tmp files
        const allFiles = fs.readdirSync(this.stateDir);
        for (const file of allFiles) {
            try {
                const filePath = path.join(this.stateDir, file);
                if (file.endsWith(".tmp")) {
                    const stats = fs.statSync(filePath);
                    if (stats.mtimeMs < tmpCutoff) {
                        fs.unlinkSync(filePath);
                    }
                    continue;
                }
                if (!file.endsWith(".json"))
                    continue;
                const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                const modified = new Date(data.lastModified || 0).getTime();
                if (data.state?.pipelineStatus === "completed" && modified < cutoff) {
                    fs.unlinkSync(filePath);
                }
            }
            catch {
                // Skip
            }
        }
        this.enforceMaxPipelines();
    }
    enforceMaxPipelines() {
        const pipelines = this.listPersistedPipelines();
        if (pipelines.length <= MAX_PIPELINES) {
            return;
        }
        const completed = pipelines
            .filter(p => p.status === "completed")
            .sort((a, b) => a.lastUpdatedAt.localeCompare(b.lastUpdatedAt));
        let toRemove = pipelines.length - MAX_PIPELINES;
        for (const p of completed) {
            if (toRemove <= 0) {
                break;
            }
            const filePath = path.join(this.stateDir, `${p.threadId}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                toRemove--;
            }
        }
    }
    ensureDir() {
        if (!fs.existsSync(this.stateDir)) {
            fs.mkdirSync(this.stateDir, { recursive: true });
        }
    }
    /** Strip sensitive metadata fields before persistence */
    sanitizeMetadata(metadata) {
        if (!metadata || typeof metadata !== "object") {
            return metadata;
        }
        const sanitized = structuredClone(metadata);
        this.deepSanitize(sanitized);
        return sanitized;
    }
    deepSanitize(obj) {
        for (const key of Object.keys(obj)) {
            if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
                delete obj[key];
            }
            else if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
                this.deepSanitize(obj[key]);
            }
        }
    }
}
exports.WorkspaceCheckpointer = WorkspaceCheckpointer;
//# sourceMappingURL=checkpointer.js.map