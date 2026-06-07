/**
 * SteeringLoader — KSA-217
 * Parses .kiro/steering/*.md files, extracts front-matter,
 * and injects relevant steering rules into LLM agent prompts.
 * Supports `targets` field: "kiro" | "langgraph" | "all" (default).
 */

import * as vscode from "vscode";
import * as path from "path";

export interface SteeringRule {
  /** File path relative to workspace */
  filePath: string;
  /** Front-matter metadata */
  meta: SteeringMeta;
  /** Markdown content (body without front-matter) */
  content: string;
}

export interface SteeringMeta {
  /** Which system this rule targets: kiro (IDE agent), langgraph (pipeline), or all */
  targets: "kiro" | "langgraph" | "all";
  /** Inclusion strategy: always, fileMatch, manual */
  inclusion: "always" | "fileMatch" | "manual";
  /** Glob pattern for fileMatch inclusion */
  fileMatchPattern?: string;
  /** Human-readable title */
  title?: string;
  /** Priority (higher = injected first). Default 0. */
  priority?: number;
}

const FRONT_MATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Load all steering rules from .kiro/steering/ directory.
 * Filters by target ("langgraph" or "all") for pipeline injection.
 */
export async function loadSteeringRules(
  workspaceRoot: string,
  target: "kiro" | "langgraph" = "langgraph"
): Promise<SteeringRule[]> {
  const steeringDir = path.join(workspaceRoot, ".kiro", "steering");

  try {
    const dirUri = vscode.Uri.file(steeringDir);
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    const mdFiles = entries
      .filter(([name, type]) => name.endsWith(".md") && type === vscode.FileType.File)
      .map(([name]) => name);

    const rules: SteeringRule[] = [];

    for (const fileName of mdFiles) {
      const filePath = path.join(steeringDir, fileName);
      const content = await readFileContent(filePath);
      if (!content) continue;

      const parsed = parseSteeringFile(content, path.join(".kiro", "steering", fileName));
      if (!parsed) continue;

      // Filter by target
      if (parsed.meta.targets === "all" || parsed.meta.targets === target) {
        // Only include "always" inclusion rules for automatic injection
        if (parsed.meta.inclusion === "always") {
          rules.push(parsed);
        }
      }
    }

    // Sort by priority (descending)
    rules.sort((a, b) => (b.meta.priority ?? 0) - (a.meta.priority ?? 0));

    return rules;
  } catch {
    // Directory doesn't exist or read failed
    return [];
  }
}

/**
 * Inject steering rules into a system prompt.
 * Appends steering content after the base system prompt.
 */
export function injectSteering(basePrompt: string, rules: SteeringRule[]): string {
  if (rules.length === 0) return basePrompt;

  const steeringBlock = rules
    .map((r) => {
      const header = r.meta.title ? `## ${r.meta.title}` : `## ${r.filePath}`;
      return `${header}\n\n${r.content}`;
    })
    .join("\n\n---\n\n");

  return `${basePrompt}\n\n# Steering Rules (auto-injected)\n\n${steeringBlock}`;
}

/**
 * Parse a steering file into metadata and content.
 */
export function parseSteeringFile(raw: string, filePath: string): SteeringRule | null {
  const match = raw.match(FRONT_MATTER_REGEX);

  if (match) {
    const frontMatter = match[1];
    const body = match[2].trim();
    const meta = parseFrontMatter(frontMatter);
    return { filePath, meta, content: body };
  }

  // No front-matter → defaults (always, all targets)
  return {
    filePath,
    meta: {
      targets: "all",
      inclusion: "always",
    },
    content: raw.trim(),
  };
}

/**
 * Parse YAML-like front-matter into SteeringMeta.
 * Simple key: value parsing (no full YAML library needed).
 */
function parseFrontMatter(raw: string): SteeringMeta {
  const meta: SteeringMeta = {
    targets: "all",
    inclusion: "always",
  };

  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");

    switch (key) {
      case "targets":
        if (value === "kiro" || value === "langgraph" || value === "all") {
          meta.targets = value;
        }
        break;
      case "inclusion":
        if (value === "always" || value === "filematch" || value === "manual") {
          meta.inclusion = value.toLowerCase() as SteeringMeta["inclusion"];
        }
        break;
      case "filematchpattern":
        meta.fileMatchPattern = value;
        break;
      case "title":
        meta.title = value;
        break;
      case "priority":
        meta.priority = parseInt(value, 10) || 0;
        break;
    }
  }

  return meta;
}

/**
 * Read file content as UTF-8 string.
 */
async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const uri = vscode.Uri.file(filePath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf-8");
  } catch {
    return null;
  }
}
