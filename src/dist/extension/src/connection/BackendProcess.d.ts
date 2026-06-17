/**
 * BackendProcess — child_process spawn/kill wrapper.
 * Implements TDD §5.4 Factory pattern for process creation.
 */
import { EventEmitter } from 'events';
export interface BackendProcessOptions {
    backendPath: string;
    port: number;
    host: string;
    env?: Record<string, string>;
}
export declare class BackendProcess extends EventEmitter {
    private process;
    private _pid;
    get pid(): number | null;
    get isRunning(): boolean;
    spawn(options: BackendProcessOptions): void;
    kill(): void;
    dispose(): void;
}
//# sourceMappingURL=BackendProcess.d.ts.map