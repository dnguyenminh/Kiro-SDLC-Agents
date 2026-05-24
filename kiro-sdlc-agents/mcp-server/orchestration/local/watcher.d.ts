/**
 * Config hot-reload watcher — uses fs.watchFile to detect changes.
 * Behavioral parity with Kotlin ConfigWatcher.kt.
 */
import { OrchestrationConfig } from '../config.js';
export declare class ConfigWatcher {
    private configPath;
    private onReload;
    private watching;
    constructor(configPath: string, onReload: (config: OrchestrationConfig) => void);
    /** Start watching config file. */
    start(): void;
    /** Stop watching. */
    stop(): void;
    private handleChange;
}
//# sourceMappingURL=watcher.d.ts.map