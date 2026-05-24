"use strict";
/**
 * File Watcher — chokidar-based file system watcher with debounce.
 * Gracefully degrades if chokidar is not installed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatcher = void 0;
const file_scanner_js_1 = require("../scanner/file-scanner.js");
class FileWatcher {
    config;
    callback;
    watcher = null;
    debounceTimers = new Map();
    constructor(config, callback) {
        this.config = config;
        this.callback = callback;
    }
    /** Start watching the workspace for file changes. */
    start() {
        this.initChokidar().catch(err => {
            console.error('[watcher] chokidar not available, file watching disabled:', err.message);
        });
    }
    /** Stop the file watcher. */
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        console.error('[watcher] Stopped');
    }
    async initChokidar() {
        const chokidar = await import('chokidar');
        const ignored = this.config.excludePatterns.map(p => `**/${p}/**`);
        this.watcher = chokidar.watch(this.config.workspace, {
            ignored: [...ignored, /(^|[\/\\])\./],
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
        });
        this.watcher.on('add', (p) => this.handleEvent(p, 'add'));
        this.watcher.on('change', (p) => this.handleEvent(p, 'change'));
        this.watcher.on('unlink', (p) => this.handleEvent(p, 'unlink'));
        console.error('[watcher] Watching for file changes');
    }
    handleEvent(filePath, event) {
        if (event !== 'unlink' && !(0, file_scanner_js_1.detectLanguage)(filePath))
            return;
        this.debounce(filePath, () => this.callback(filePath, event));
    }
    debounce(key, fn) {
        const existing = this.debounceTimers.get(key);
        if (existing)
            clearTimeout(existing);
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            fn();
        }, this.config.watchDebounceMs);
        this.debounceTimers.set(key, timer);
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=file-watcher.js.map