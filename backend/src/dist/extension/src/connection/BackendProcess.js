"use strict";
/**
 * BackendProcess — child_process spawn/kill wrapper.
 * Implements TDD §5.4 Factory pattern for process creation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendProcess = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
class BackendProcess extends events_1.EventEmitter {
    process = null;
    _pid = null;
    get pid() {
        return this._pid;
    }
    get isRunning() {
        return this.process !== null && !this.process.killed;
    }
    spawn(options) {
        if (this.isRunning) {
            return;
        }
        const env = {
            ...process.env,
            ...options.env,
            BACKEND_PORT: String(options.port),
            BACKEND_HOST: options.host,
        };
        this.process = (0, child_process_1.spawn)('node', [options.backendPath], {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,
        });
        this._pid = this.process.pid ?? null;
        this.process.on('exit', (code, signal) => {
            this._pid = null;
            this.process = null;
            this.emit('exit', { code, signal });
        });
        this.process.on('error', (error) => {
            this._pid = null;
            this.process = null;
            this.emit('error', error);
        });
        if (this.process.stdout) {
            this.process.stdout.on('data', (data) => {
                this.emit('stdout', data.toString());
            });
        }
        if (this.process.stderr) {
            this.process.stderr.on('data', (data) => {
                this.emit('stderr', data.toString());
            });
        }
    }
    kill() {
        if (this.process && !this.process.killed) {
            this.process.kill('SIGTERM');
            // Force kill after 5s if still running
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);
        }
    }
    dispose() {
        this.kill();
        this.removeAllListeners();
    }
}
exports.BackendProcess = BackendProcess;
//# sourceMappingURL=BackendProcess.js.map