/**
 * SteeringProvider — .kiro/steering/ files reading
 * KSA-252
 */

import * as fs from 'fs';
import * as path from 'path';

export class SteeringProvider {
  private steeringDir: string;

  constructor(workspaceRoot: string) {
    this.steeringDir = path.join(workspaceRoot, '.kiro', 'steering');
  }

  async getList(): Promise<string[]> {
    try {
      const entries = fs.readdirSync(this.steeringDir);
      return entries.filter(e => e.endsWith('.md'));
    } catch {
      return [];
    }
  }

  async getContent(fileName: string): Promise<string> {
    const filePath = path.join(this.steeringDir, fileName);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return `[Error: Cannot read ${fileName}]`;
    }
  }
}
