/**
 * Config hot-reload watcher — uses fs.watchFile to detect changes.
 * Behavioral parity with Kotlin ConfigWatcher.kt.
 */

import * as fs from 'fs';
import { OrchestrationConfig, loadOrchestrationConfig } from '../config.js';
import * as path from 'path';

export class ConfigWatcher {
  private configPath: string;
  private onReload: (config: OrchestrationConfig) => void;
  private watching = false;

  constructor(configPath: string, onReload: (config: OrchestrationConfig) => void) {
    this.configPath = configPath;
    this.onReload = onReload;
  }

  /** Start watching config file. */
  start(): void {
    if (this.watching) return;
    this.watching = true;
    fs.watchFile(this.configPath, { interval: 2000 }, () => this.handleChange());
    console.error(`[orchestration] ConfigWatcher started for: ${this.configPath}`);
  }

  /** Stop watching. */
  stop(): void {
    if (!this.watching) return;
    fs.unwatchFile(this.configPath);
    this.watching = false;
    console.error('[orchestration] ConfigWatcher stopped');
  }

  private handleChange(): void {
    console.error('[orchestration] Config file changed, reloading...');
    const workspace = path.dirname(path.dirname(this.configPath));
    const config = loadOrchestrationConfig(workspace);
    if (config) {
      this.onReload(config);
      const count = Object.keys(config.mcpServers).filter((k) => !config.mcpServers[k].disabled).length;
      console.error(`[orchestration] Config reloaded: ${count} servers`);
    } else {
      console.error('[orchestration] Config reload failed — keeping current config');
    }
  }
}
