/**
 * Index state persistence — tracks file hashes for incremental indexing.
 * Stored as .sf-index-state.json in the project root.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IndexState, FileHashEntry, MetadataType, ChangeSet, FileInfo } from './types.js';

const STATE_FILENAME = '.sf-index-state.json';
const STATE_VERSION = 1;

export class IndexStateManager {
  private statePath: string;
  private state: IndexState;

  constructor(projectRoot: string) {
    this.statePath = path.join(projectRoot, STATE_FILENAME);
    this.state = this.createEmpty(projectRoot);
  }

  /** Load state from disk. Returns empty state if file missing or corrupted. */
  load(): IndexState {
    try {
      if (!fs.existsSync(this.statePath)) {
        return this.state;
      }
      const content = fs.readFileSync(this.statePath, 'utf-8');
      const parsed = JSON.parse(content) as IndexState;
      if (parsed.version !== STATE_VERSION) {
        console.error('[index-state] Version mismatch, resetting state');
        return this.state;
      }
      this.state = parsed;
      return this.state;
    } catch (err) {
      console.error('[index-state] Failed to load state, resetting:', (err as Error).message);
      return this.state;
    }
  }

  /** Save current state to disk */
  save(): void {
    try {
      this.state.last_indexed = new Date().toISOString();
      this.state.total_files = Object.keys(this.state.files).length;
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[index-state] Failed to save state:', (err as Error).message);
    }
  }

  /** Compare current files against stored hashes to find changes */
  getChangedFiles(currentFiles: FileInfo[]): ChangeSet {
    const added: string[] = [];
    const modified: string[] = [];
    const unchanged: string[] = [];
    const currentPaths = new Set(currentFiles.map(f => f.path));

    for (const file of currentFiles) {
      const existing = this.state.files[file.path];
      if (!existing) {
        added.push(file.path);
      } else if (existing.hash !== file.hash) {
        modified.push(file.path);
      } else {
        unchanged.push(file.path);
      }
    }

    // Files in state but not in current = deleted
    const deleted = Object.keys(this.state.files).filter(p => !currentPaths.has(p));

    return { added, modified, deleted, unchanged };
  }

  /** Update hash entry for a single file */
  updateFileHash(filePath: string, hash: string, type: MetadataType, name: string): void {
    this.state.files[filePath] = {
      hash,
      indexed_at: new Date().toISOString(),
      type,
      name,
    };
  }

  /** Remove a file from state */
  removeFile(filePath: string): void {
    delete this.state.files[filePath];
  }

  /** Get current state */
  getState(): IndexState {
    return this.state;
  }

  /** Reset state to empty */
  reset(projectPath: string): void {
    this.state = this.createEmpty(projectPath);
  }

  private createEmpty(projectPath: string): IndexState {
    return {
      version: STATE_VERSION,
      project_path: projectPath,
      last_indexed: '',
      total_files: 0,
      files: {},
    };
  }
}
