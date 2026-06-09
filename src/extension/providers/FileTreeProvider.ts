/**
 * FileTreeProvider — Workspace file and folder tree resolution
 * KSA-252
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FileTreeNode, FolderTreeNode } from '../../shared/protocol';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  '.vscode', '.idea', 'coverage', '.cache', '.code-intel',
]);

const MAX_FILES = 200;

export class FileTreeProvider {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async getTree(maxDepth = 4): Promise<FileTreeNode[]> {
    return this.scanDir(this.workspaceRoot, 0, maxDepth);
  }

  async getFolderTree(maxDepth = 4): Promise<FolderTreeNode[]> {
    return this.scanFolders(this.workspaceRoot, 0, maxDepth);
  }

  async readFiles(relativePaths: string[]): Promise<{ path: string; content: string }[]> {
    const results: { path: string; content: string }[] = [];
    for (const relPath of relativePaths) {
      const fullPath = path.join(this.workspaceRoot, relPath);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        results.push({ path: relPath, content });
      } catch {
        results.push({ path: relPath, content: '[Error reading file]' });
      }
    }
    return results;
  }

  async listFolder(folderPath: string): Promise<string[]> {
    const fullPath = path.join(this.workspaceRoot, folderPath);
    try {
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      return entries.map(e => e.isDirectory() ? `${e.name}/` : e.name);
    } catch {
      return [];
    }
  }

  private scanDir(dirPath: string, depth: number, maxDepth: number): FileTreeNode[] {
    if (depth >= maxDepth) return [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const results: FileTreeNode[] = [];
    let fileCount = 0;

    for (const entry of entries) {
      if (fileCount >= MAX_FILES) break;
      if (entry.name.startsWith('.') && IGNORE_DIRS.has(entry.name)) continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = this.scanDir(fullPath, depth + 1, maxDepth);
        results.push({ name: entry.name, path: relativePath, type: 'directory', children });
      } else {
        results.push({ name: entry.name, path: relativePath, type: 'file' });
        fileCount++;
      }
    }

    return results;
  }

  private scanFolders(dirPath: string, depth: number, maxDepth: number): FolderTreeNode[] {
    if (depth >= maxDepth) return [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const results: FolderTreeNode[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
      const children = this.scanFolders(fullPath, depth + 1, maxDepth);
      results.push({ name: entry.name, path: relativePath, children });
    }

    return results;
  }
}
