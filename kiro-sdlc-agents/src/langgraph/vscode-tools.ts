/**
 * VscodeTools — KSA-235
 * Provides basic IDE tools (read_file, list_directory, search_text, write_file, get_diagnostics)
 * directly via VS Code API. These tools don't require MCP — they run in-extension.
 *
 * Used by chat-graph execute_tools node when tool name matches a VS Code tool.
 */

import * as vscode from "vscode";
import * as path from "path";
import type { McpToolDefinition } from "./tool-registry";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const VSCODE_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the content of a file. Returns the full text content. Use relative paths from workspace root.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to workspace root" },
        start_line: { type: "number", description: "Optional start line (1-indexed)" },
        end_line: { type: "number", description: "Optional end line (1-indexed)" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories at the given path. Returns names with type indicators (d for directory, f for file).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path relative to workspace root" },
        recursive: { type: "boolean", description: "Whether to list recursively (default false, max depth 2)" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_text",
    description: "Search for text pattern in files. Returns matching lines with file paths and line numbers.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Text or regex pattern to search for" },
        include: { type: "string", description: "Glob pattern for files to include (e.g. '**/*.ts')" },
        max_results: { type: "number", description: "Maximum results to return (default 20)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to workspace root" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "get_diagnostics",
    description: "Get compile errors, warnings, and lint issues for a file or the entire workspace.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path (optional — omit for all workspace diagnostics)" },
      },
    },
  },
  {
    name: "get_open_files",
    description: "Get the list of currently open files in the editor.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ─── Tool Names Set (for fast lookup) ─────────────────────────────────────────

const VSCODE_TOOL_NAMES = new Set(VSCODE_TOOL_DEFINITIONS.map(t => t.name));

/** Check if a tool name is a VS Code tool (handled locally, not via MCP) */
export function isVscodeTool(name: string): boolean {
  return VSCODE_TOOL_NAMES.has(name);
}

// ─── Tool Execution ───────────────────────────────────────────────────────────

/**
 * Execute a VS Code tool by name with given arguments.
 * Returns the tool result as a string.
 */
export async function executeVscodeTool(
  name: string,
  args: Record<string, unknown>,
  workspaceRoot: string
): Promise<string> {
  // Use provided workspaceRoot, or detect from VS Code API
  const wsRoot = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  switch (name) {
    case "read_file":
      return readFile(args, wsRoot);
    case "list_directory":
      return listDirectory(args, wsRoot);
    case "search_text":
      return searchText(args, wsRoot);
    case "write_file":
      return writeFile(args, wsRoot);
    case "get_diagnostics":
      return getDiagnostics(args, wsRoot);
    case "get_open_files":
      return getOpenFiles();
    default:
      return `Error: Unknown VS Code tool '${name}'`;
  }
}


// ─── Tool Implementations ─────────────────────────────────────────────────────

async function readFile(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const filePath = args.path as string;
  if (!filePath) return "Error: 'path' is required";

  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  const uri = vscode.Uri.file(fullPath);

  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString("utf-8");

    const startLine = args.start_line as number | undefined;
    const endLine = args.end_line as number | undefined;

    if (startLine || endLine) {
      const lines = text.split("\n");
      const start = Math.max(0, (startLine || 1) - 1);
      const end = endLine ? Math.min(lines.length, endLine) : lines.length;
      return lines.slice(start, end).join("\n");
    }

    if (text.length > 50000) {
      return text.substring(0, 50000) + "\n\n[... truncated at 50KB ...]";
    }
    return text;
  } catch (error) {
    return `Error reading file '${filePath}': ${(error as Error).message}`;
  }
}

async function listDirectory(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const dirPath = (args.path as string) || ".";
  const recursive = args.recursive as boolean || false;

  const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(workspaceRoot, dirPath);
  const uri = vscode.Uri.file(fullPath);

  try {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    const results: string[] = [];

    for (const [name, type] of entries) {
      const prefix = type === vscode.FileType.Directory ? "d" : "f";
      results.push(`${prefix} ${name}`);

      if (recursive && type === vscode.FileType.Directory) {
        try {
          const subUri = vscode.Uri.file(path.join(fullPath, name));
          const subEntries = await vscode.workspace.fs.readDirectory(subUri);
          for (const [subName, subType] of subEntries) {
            const subPrefix = subType === vscode.FileType.Directory ? "d" : "f";
            results.push(`  ${subPrefix} ${name}/${subName}`);
          }
        } catch { /* skip inaccessible subdirs */ }
      }
    }

    if (results.length > 200) {
      return results.slice(0, 200).join("\n") + `\n\n[... ${results.length - 200} more entries ...]`;
    }
    return results.join("\n") || "(empty directory)";
  } catch (error) {
    return `Error listing '${dirPath}': ${(error as Error).message}`;
  }
}

async function searchText(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const pattern = args.pattern as string;
  if (!pattern) return "Error: 'pattern' is required";

  const include = (args.include as string) || "**/*";
  const maxResults = (args.max_results as number) || 20;

  try {
    const files = await vscode.workspace.findFiles(include, "**/node_modules/**", 100);
    const results: string[] = [];
    const regex = new RegExp(pattern, "gi");

    for (const file of files) {
      if (results.length >= maxResults) break;

      try {
        const content = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(content).toString("utf-8");
        const lines = text.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break;
          if (regex.test(lines[i])) {
            const relativePath = vscode.workspace.asRelativePath(file);
            results.push(`${relativePath}:${i + 1}: ${lines[i].trim().substring(0, 200)}`);
            regex.lastIndex = 0;
          }
        }
      } catch { /* skip unreadable files */ }
    }

    return results.length > 0
      ? results.join("\n")
      : `No matches found for '${pattern}' in ${include}`;
  } catch (error) {
    return `Error searching: ${(error as Error).message}`;
  }
}

async function writeFile(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const filePath = args.path as string;
  const content = args.content as string;
  if (!filePath) return "Error: 'path' is required";
  if (content === undefined) return "Error: 'content' is required";

  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  const uri = vscode.Uri.file(fullPath);

  try {
    const encoded = Buffer.from(content, "utf-8");
    await vscode.workspace.fs.writeFile(uri, encoded);
    return `File written: ${filePath} (${encoded.length} bytes)`;
  } catch (error) {
    return `Error writing file '${filePath}': ${(error as Error).message}`;
  }
}

async function getDiagnostics(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const filePath = args.path as string | undefined;

  if (filePath) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
    const uri = vscode.Uri.file(fullPath);
    const diagnostics = vscode.languages.getDiagnostics(uri);

    if (diagnostics.length === 0) return `No issues in ${filePath}`;
    return diagnostics.map(d =>
      `${filePath}:${d.range.start.line + 1}: [${vscode.DiagnosticSeverity[d.severity]}] ${d.message}`
    ).join("\n");
  }

  const allDiags = vscode.languages.getDiagnostics();
  const results: string[] = [];
  for (const [uri, diagnostics] of allDiags) {
    if (diagnostics.length === 0) continue;
    const relative = vscode.workspace.asRelativePath(uri);
    for (const d of diagnostics) {
      results.push(`${relative}:${d.range.start.line + 1}: [${vscode.DiagnosticSeverity[d.severity]}] ${d.message}`);
    }
  }

  if (results.length === 0) return "No diagnostics in workspace";
  if (results.length > 50) {
    return results.slice(0, 50).join("\n") + `\n\n[... ${results.length - 50} more issues ...]`;
  }
  return results.join("\n");
}

async function getOpenFiles(): Promise<string> {
  const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
  const files = tabs
    .filter(t => t.input instanceof vscode.TabInputText)
    .map(t => {
      const input = t.input as vscode.TabInputText;
      return vscode.workspace.asRelativePath(input.uri);
    });

  return files.length > 0 ? files.join("\n") : "No files open";
}
