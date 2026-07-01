/**
 * VscodeTools — KSA-235: Execution logic for IDE-native tools.
 * Tool definitions in vscode-tool-definitions.ts.
 */
import * as vscode from "vscode";
import * as path from "path";
export { VSCODE_TOOL_DEFINITIONS, isVscodeTool } from "./vscode-tool-definitions";

export async function executeVscodeTool(name: string, args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const wsRoot = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
  switch (name) {
    case "read_file": return readFile(args, wsRoot);
    case "list_directory": return listDirectory(args, wsRoot);
    case "search_text": return searchText(args, wsRoot);
    case "write_file": return writeFile(args, wsRoot);
    case "get_diagnostics": return getDiagnostics(args, wsRoot);
    case "get_open_files": return getOpenFiles();
    default: return `Error: Unknown VS Code tool '${name}'`;
  }
}

async function readFile(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const filePath = args.path as string;
  if (!filePath) return "Error: 'path' is required";
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  try {
    const text = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(fullPath))).toString("utf-8");
    const startLine = args.start_line as number | undefined;
    const endLine = args.end_line as number | undefined;
    if (startLine || endLine) {
      const lines = text.split("\n");
      return lines.slice(Math.max(0, (startLine || 1) - 1), endLine ? Math.min(lines.length, endLine) : lines.length).join("\n");
    }
    return text.length > 50000 ? text.substring(0, 50000) + "\n\n[... truncated at 50KB ...]" : text;
  } catch (error) { return `Error reading '${filePath}': ${(error as Error).message}`; }
}

async function listDirectory(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const dirPath = (args.path as string) || ".";
  const recursive = args.recursive as boolean || false;
  const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(workspaceRoot, dirPath);
  const EXCLUDE = new Set([".git", "node_modules", "out", "dist", ".code-intel", ".pytest_cache", "__pycache__"]);
  const EXCLUDE_EXT = new Set([".log", ".vsix"]);
  try {
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(fullPath));
    const results: string[] = [];
    for (const [name, type] of entries) {
      if (EXCLUDE.has(name)) continue;
      if (type === vscode.FileType.File && EXCLUDE_EXT.has(path.extname(name).toLowerCase())) continue;
      results.push(`${type === vscode.FileType.Directory ? "d" : "f"} ${name}`);
      if (recursive && type === vscode.FileType.Directory) {
        try {
          const subEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(path.join(fullPath, name)));
          for (const [sn, st] of subEntries) {
            if (EXCLUDE.has(sn)) continue;
            results.push(`  ${st === vscode.FileType.Directory ? "d" : "f"} ${name}/${sn}`);
          }
        } catch { /* skip */ }
      }
    }
    if (results.length > 100) return results.slice(0, 100).join("\n") + `\n\n[... ${results.length - 100} more ...]`;
    return results.join("\n") || "(empty directory)";
  } catch (error) { return `Error listing '${dirPath}': ${(error as Error).message}`; }
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
        const lines = Buffer.from(await vscode.workspace.fs.readFile(file)).toString("utf-8").split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break;
          if (regex.test(lines[i])) { results.push(`${vscode.workspace.asRelativePath(file)}:${i + 1}: ${lines[i].trim().substring(0, 200)}`); regex.lastIndex = 0; }
        }
      } catch { /* skip */ }
    }
    return results.length > 0 ? results.join("\n") : `No matches for '${pattern}'`;
  } catch (error) { return `Error searching: ${(error as Error).message}`; }
}

async function writeFile(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const filePath = args.path as string;
  const content = args.content as string;
  if (!filePath) return "Error: 'path' is required";
  if (content === undefined) return "Error: 'content' is required";
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  try {
    const encoded = Buffer.from(content, "utf-8");
    await vscode.workspace.fs.writeFile(vscode.Uri.file(fullPath), encoded);
    return `File written: ${filePath} (${encoded.length} bytes)`;
  } catch (error) { return `Error writing '${filePath}': ${(error as Error).message}`; }
}

async function getDiagnostics(args: Record<string, unknown>, workspaceRoot: string): Promise<string> {
  const filePath = args.path as string | undefined;
  if (filePath) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
    const diagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(fullPath));
    if (diagnostics.length === 0) return `No issues in ${filePath}`;
    return diagnostics.map(d => `${filePath}:${d.range.start.line + 1}: [${vscode.DiagnosticSeverity[d.severity]}] ${d.message}`).join("\n");
  }
  const allDiags = vscode.languages.getDiagnostics();
  const results: string[] = [];
  for (const [uri, diagnostics] of allDiags) {
    if (diagnostics.length === 0) continue;
    for (const d of diagnostics) { results.push(`${vscode.workspace.asRelativePath(uri)}:${d.range.start.line + 1}: [${vscode.DiagnosticSeverity[d.severity]}] ${d.message}`); }
  }
  if (results.length === 0) return "No diagnostics in workspace";
  return results.length > 50 ? results.slice(0, 50).join("\n") + `\n\n[... ${results.length - 50} more ...]` : results.join("\n");
}

async function getOpenFiles(): Promise<string> {
  const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
  const files = tabs.filter(t => t.input instanceof vscode.TabInputText).map(t => vscode.workspace.asRelativePath((t.input as vscode.TabInputText).uri));
  return files.length > 0 ? files.join("\n") : "No files open";
}
