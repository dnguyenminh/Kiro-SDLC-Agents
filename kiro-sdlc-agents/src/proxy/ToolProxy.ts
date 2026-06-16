/**
 * ToolProxy — Routes tool calls between local execution and remote backend.
 * Local tools (embed_images, etc.) run in-extension; everything else forwards to backend.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { HttpClient, ToolResult } from "./HttpClient";

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class ToolProxy {
  private localTools = new Set(["embed_images"]);
  private toolRegistry: Map<string, ToolDefinition> = new Map();

  constructor(private readonly httpClient: HttpClient) {}

  async refreshTools(): Promise<void> {
    try {
      const tools = await this.httpClient.get<ToolDefinition[]>("/mcp/tools/list");
      this.toolRegistry.clear();
      for (const tool of tools) { this.toolRegistry.set(tool.name, tool); }
    } catch { /* non-fatal */ }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (this.localTools.has(name)) { return this.executeLocal(name, args); }
    return this.httpClient.callTool(name, args);
  }

  getAvailableTools(): ToolDefinition[] { return [...this.toolRegistry.values()]; }

  async invokeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.callTool(name, args);
    if (result.content && result.content.length > 0) { return result.content.map((c) => c.text).join("\n"); }
    return "";
  }

  private async executeLocal(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (name === "embed_images") { return this.embedImages(args); }
    return { content: [{ type: "text", text: "Unknown local tool: " + name }] };
  }

  private embedImages(args: Record<string, unknown>): ToolResult {
    const filePath = args.file_path as string;
    const outputPath = args.output_path as string;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return { content: [{ type: "text", text: "No workspace folder open" }] }; }

    const absInput = path.join(root, filePath);
    const absOutput = path.join(root, outputPath);
    if (!fs.existsSync(absInput)) { return { content: [{ type: "text", text: "File not found: " + filePath }] }; }

    let markdown = fs.readFileSync(absInput, "utf-8");
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(markdown)) !== null) {
      const imgPath = match[2];
      if (imgPath.startsWith("data:") || imgPath.startsWith("http")) { continue; }
      const absImgPath = path.resolve(path.dirname(absInput), imgPath);
      if (fs.existsSync(absImgPath)) {
        const ext = path.extname(absImgPath).replace(".", "");
        const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/" + ext;
        const data = fs.readFileSync(absImgPath).toString("base64");
        markdown = markdown.replace(match[0], "![" + match[1] + "](data:" + mime + ";base64," + data + ")");
      }
    }

    fs.mkdirSync(path.dirname(absOutput), { recursive: true });
    fs.writeFileSync(absOutput, markdown, "utf-8");
    return { content: [{ type: "text", text: "Embedded images written to: " + absOutput }] };
  }
}
