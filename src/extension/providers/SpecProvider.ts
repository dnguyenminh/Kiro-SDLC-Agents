/**
 * SpecProvider — .kiro/specs/ directory reading
 * KSA-252
 */

import * as fs from 'fs';
import * as path from 'path';

export class SpecProvider {
  private workspaceRoot: string;
  private specsDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.specsDir = path.join(workspaceRoot, '.kiro', 'specs');
  }

  async getList(): Promise<string[]> {
    try {
      const entries = fs.readdirSync(this.specsDir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return [];
    }
  }

  async getContent(specName: string): Promise<{ requirements: string; design: string; tasks: string }> {
    const specDir = path.join(this.specsDir, specName);
    return {
      requirements: this.readFile(path.join(specDir, 'requirements.md')),
      design: this.readFile(path.join(specDir, 'design.md')),
      tasks: this.readFile(path.join(specDir, 'tasks.md')),
    };
  }

  private readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return '';
    }
  }
}
