/**
 * SteeringLoader — KSA-217, KSA-242
 * Parses .kiro/steering/ files (including subdirectories) recursively,
 * extracts front-matter, and injects relevant steering rules into LLM agent prompts.
 * Supports `targets` field: "kiro" | "langgraph" | "all" (default).
 *
 * KSA-242 fixes:
 * - Recursive scan: now includes subdirectories (e.g., patterns/)
 * - inclusion: "auto" treated as "always" for langgraph target
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
  /** Inclusion strategy: always, auto, fileMatch, manual */
  inclusion: "always" | "auto" | "fileMatch" | "manual";
  /** Glob pattern for fileMatch inclusion */
  fileMatchPattern?: string;
  /** Human-readable title */
  title?: string;
  /** Priority (higher = injected first). Default 0. */
  priority?: number;
}

const FRONT_MATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Inclusion strategies that qualify for automatic injection into langgraph prompts.
 * "always" = always inject; "auto" = inject automatically (same behavior for pipeline).
 */
const AUTO_INJECT_INCLUSIONS: Set<string> = new Set(["always", "auto"]);

/**
 * Load all steering rules from .kiro/steering/ directory (recursively).
 * Filters by target ("langgraph" or "all") for pipeline injection.
 */
export async function loadSteeringRules(
  workspaceRoot: string,
  target: "kiro" | "langgraph" = "langgraph"
): Promise<SteeringRule[]> {
  const steeringDir = path.join(workspaceRoot, ".kiro", "steering");

  try {
    const rules: SteeringRule[] = [];
    await scanDirectoryRecursive(steeringDir, steeringDir, target, rules);

    // Sort by priority (descending)
    rules.sort((a, b) => (b.meta.priority ?? 0) - (a.meta.priority ?? 0));

    return rules;
  } catch {
    // Directory doesn't exist or read failed
    return [];
  }
}

/**
 * Recursively scan a directory for .md steering files.
 * KSA-242: Supports subdirectories (e.g., .kiro/steering/patterns/).
 */
async function scanDirectoryRecursive(
  currentDir: string,
  rootSteeringDir: string,
  target: "kiro" | "langgraph" | "all",
  rules: SteeringRule[]
): Promise<void> {
  const dirUri = vscode.Uri.file(currentDir);
  let entries: [string, vscode.FileType][];

  try {
    entries = await vscode.workspace.fs.readDirectory(dirUri);
  } catch {
    return; // Directory unreadable, skip
  }

  for (const [name, type] of entries) {
    const fullPath = path.join(currentDir, name);

    if (type === vscode.FileType.Directory) {
      // Recurse into subdirectory
      await scanDirectoryRecursive(fullPath, rootSteeringDir, target, rules);
    } else if (type === vscode.FileType.File && name.endsWith(".md")) {
      // Process markdown file
      const content = await readFileContent(fullPath);
      if (!content) continue;

      // Build relative path from .kiro/steering/ root
      const relativePath = path.relative(
        path.join(rootSteeringDir, ".."), // parent of steering = .kiro
        fullPath
      ).replace(/\\/g, "/");
      // Result: "steering/patterns/ai-agent.md" → prefix with .kiro/
      const filePath = `.kiro/${relativePath}`;

      const parsed = parseSteeringFile(content, filePath);
      if (!parsed) continue;

      // Filter by target
      if (parsed.meta.targets === "all" || parsed.meta.targets === target) {
        // KSA-242: Accept "always" AND "auto" for automatic injection
        if (AUTO_INJECT_INCLUSIONS.has(parsed.meta.inclusion)) {
          rules.push(parsed);
        }
      }
    }
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

  // KSA-279: No front-matter -> conservative default for pipeline.
  // Files without explicit inclusion should NOT flood the pipeline context.
  // Pipeline agents already receive role-specific prompts; only files that
  // EXPLICITLY declare inclusion: always/auto should auto-inject.
  return {
    filePath,
    meta: {
      targets: "all",
      inclusion: "manual",
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
        if (value === "always" || value === "auto" || value === "filematch" || value === "manual") {
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
