/**
 * GitDiffProvider — Git diff resolution
 * KSA-252
 */

import { execSync } from 'child_process';

export class GitDiffProvider {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async getDiff(): Promise<string> {
    try {
      const unstaged = execSync('git diff', { cwd: this.workspaceRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 });
      const staged = execSync('git diff --staged', { cwd: this.workspaceRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 });

      const parts: string[] = [];
      if (staged.trim()) parts.push('=== Staged Changes ===\n' + staged);
      if (unstaged.trim()) parts.push('=== Unstaged Changes ===\n' + unstaged);

      return parts.length > 0 ? parts.join('\n\n') : 'No changes detected.';
    } catch (err) {
      return `[Git error: ${(err as Error).message}]`;
    }
  }
}
