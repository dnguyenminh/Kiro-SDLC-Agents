"use strict";
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
exports.loadSteeringRules = loadSteeringRules;
exports.injectSteering = injectSteering;
exports.parseSteeringFile = parseSteeringFile;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const FRONT_MATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
/**
 * Inclusion strategies that qualify for automatic injection into langgraph prompts.
 * "always" = always inject; "auto" = inject automatically (same behavior for pipeline).
 */
const AUTO_INJECT_INCLUSIONS = new Set(["always", "auto"]);
/**
 * Load all steering rules from .kiro/steering/ directory (recursively).
 * Filters by target ("langgraph" or "all") for pipeline injection.
 */
async function loadSteeringRules(workspaceRoot, target = "langgraph") {
    const steeringDir = path.join(workspaceRoot, ".kiro", "steering");
    try {
        const rules = [];
        await scanDirectoryRecursive(steeringDir, steeringDir, target, rules);
        // Sort by priority (descending)
        rules.sort((a, b) => (b.meta.priority ?? 0) - (a.meta.priority ?? 0));
        return rules;
    }
    catch {
        // Directory doesn't exist or read failed
        return [];
    }
}
/**
 * Recursively scan a directory for .md steering files.
 * KSA-242: Supports subdirectories (e.g., .kiro/steering/patterns/).
 */
async function scanDirectoryRecursive(currentDir, rootSteeringDir, target, rules) {
    const dirUri = vscode.Uri.file(currentDir);
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(dirUri);
    }
    catch {
        return; // Directory unreadable, skip
    }
    for (const [name, type] of entries) {
        const fullPath = path.join(currentDir, name);
        if (type === vscode.FileType.Directory) {
            // Recurse into subdirectory
            await scanDirectoryRecursive(fullPath, rootSteeringDir, target, rules);
        }
        else if (type === vscode.FileType.File && name.endsWith(".md")) {
            // Process markdown file
            const content = await readFileContent(fullPath);
            if (!content)
                continue;
            // Build relative path from .kiro/steering/ root
            const relativePath = path.relative(path.join(rootSteeringDir, ".."), // parent of steering = .kiro
            fullPath).replace(/\\/g, "/");
            // Result: "steering/patterns/ai-agent.md" → prefix with .kiro/
            const filePath = `.kiro/${relativePath}`;
            const parsed = parseSteeringFile(content, filePath);
            if (!parsed)
                continue;
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
function injectSteering(basePrompt, rules) {
    if (rules.length === 0)
        return basePrompt;
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
function parseSteeringFile(raw, filePath) {
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
function parseFrontMatter(raw) {
    const meta = {
        targets: "all",
        inclusion: "always",
    };
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1)
            continue;
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
                    meta.inclusion = value.toLowerCase();
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
async function readFileContent(filePath) {
    try {
        const uri = vscode.Uri.file(filePath);
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString("utf-8");
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=steering-loader.js.map