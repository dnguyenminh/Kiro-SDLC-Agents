/**
 * SFDX project detection utility.
 * Detects sfdx-project.json and resolves package directories.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SfdxProject } from './types.js';

export class SfdxDetector {
  /**
   * Detect SFDX project at given path.
   * Checks for sfdx-project.json at root and one level deep.
   */
  detect(searchPath: string): SfdxProject | null {
    // Check root
    if (this.isValidSfdxProject(searchPath)) {
      return this.buildProject(searchPath);
    }

    // Check one level deep
    try {
      const entries = fs.readdirSync(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const dirPath = path.join(searchPath, entry.name);
          if (this.isValidSfdxProject(dirPath)) {
            return this.buildProject(dirPath);
          }
        }
      }
    } catch {
      // Directory not readable
    }

    return null;
  }

  /**
   * Check if path contains a valid SFDX project.
   */
  isValidSfdxProject(projectPath: string): boolean {
    const configPath = path.join(projectPath, 'sfdx-project.json');
    return fs.existsSync(configPath);
  }

  /**
   * Extract package directories from sfdx-project.json config.
   */
  getPackageDirectories(config: any): string[] {
    if (!config || !Array.isArray(config.packageDirectories)) {
      return ['force-app'];
    }
    return config.packageDirectories.map((pd: any) => pd.path ?? pd).filter(Boolean);
  }

  private buildProject(root: string): SfdxProject | null {
    try {
      const configPath = path.join(root, 'sfdx-project.json');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      return {
        root,
        config,
        packageDirectories: this.getPackageDirectories(config),
      };
    } catch {
      return null;
    }
  }
}
