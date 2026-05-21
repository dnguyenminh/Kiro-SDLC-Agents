/**
 * DebouncedPersistence — coalesces rapid writes into one file I/O operation.
 */

import * as fs from 'fs';
import * as path from 'path';

export class DebouncedPersistence {
  private filePath: string;
  private debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingData: any = null;

  constructor(filePath: string, debounceSeconds: number = 5.0) {
    this.filePath = filePath;
    this.debounceMs = debounceSeconds * 1000;
  }

  /** Schedule a debounced write. Resets timer on each call. */
  scheduleWrite(data: any): void {
    this.pendingData = data;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.doWrite(), this.debounceMs);
  }

  /** Force immediate write if pending. */
  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.doWrite();
  }

  /** Load JSON from file. Returns null if missing or corrupt. */
  load(): Record<string, any> | null {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      const text = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(text);
    } catch (e: any) {
      console.error(`[cache-persist] Load failed (${this.filePath}): ${e.message}`);
      return null;
    }
  }

  private doWrite(): void {
    const data = this.pendingData;
    this.pendingData = null;
    this.timer = null;
    if (data === null) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const text = JSON.stringify(data, null, 2);
      fs.writeFileSync(this.filePath, text, 'utf-8');
    } catch (e: any) {
      console.error(`[cache-persist] Write failed (${this.filePath}): ${e.message}`);
    }
  }
}
