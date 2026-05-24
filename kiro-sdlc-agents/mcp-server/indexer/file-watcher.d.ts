/**
 * File Watcher — chokidar-based file system watcher with debounce.
 * Gracefully degrades if chokidar is not installed.
 */
import { AppConfig } from '../config.js';
type WatchEvent = 'add' | 'change' | 'unlink';
type WatchCallback = (filePath: string, event: WatchEvent) => void;
export declare class FileWatcher {
    private config;
    private callback;
    private watcher;
    private debounceTimers;
    constructor(config: AppConfig, callback: WatchCallback);
    /** Start watching the workspace for file changes. */
    start(): void;
    /** Stop the file watcher. */
    stop(): void;
    private initChokidar;
    private handleEvent;
    private debounce;
}
export {};
//# sourceMappingURL=file-watcher.d.ts.map