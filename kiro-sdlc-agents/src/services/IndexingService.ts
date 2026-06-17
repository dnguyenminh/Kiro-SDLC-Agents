/**
 * IndexingService — Upload documents and source files to remote backend for indexing.
 */

import * as vscode from "vscode";
import { HttpClient } from "../proxy/HttpClient";

export class IndexingService {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Index markdown/document files.
   */
  async indexDocuments(): Promise<{ indexed: number }> {
    const files = await vscode.workspace.findFiles(
      "**/*.md",
      "{node_modules,dist,.git,build,out}/**"
    );
    return this.uploadFiles(files, "/api/index/documents");
  }

  /**
   * Index source code files.
   */
  async indexSource(): Promise<{ indexed: number }> {
    const files = await vscode.workspace.findFiles(
      "**/*.{ts,js,kt,java,py,go,rs,tsx,jsx}",
      "{node_modules,dist,.git,build,out}/**"
    );
    return this.uploadFiles(files, "/api/index/source");
  }

  private async uploadFiles(
    files: vscode.Uri[],
    endpoint: string
  ): Promise<{ indexed: number }> {
    const maxSize = 1_000_000; // 1MB limit per file
    const batch: Array<{ path: string; content: string }> = [];

    for (const file of files.slice(0, 500)) {
      const stat = await vscode.workspace.fs.stat(file);
      if (stat.size > maxSize) { continue; }
      const content = await vscode.workspace.fs.readFile(file);
      const relativePath = vscode.workspace.asRelativePath(file);
      batch.push({
        path: relativePath,
        content: Buffer.from(content).toString("utf-8"),
      });
    }

    const result = await this.httpClient.post<{ indexed: number }>(
      endpoint,
      { files: batch },
      600000
    );
    return result;
  }
}
