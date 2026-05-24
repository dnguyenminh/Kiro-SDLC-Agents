"use strict";
/**
 * JSON-RPC 2.0 over stdio pipes — sends requests to child process stdin,
 * reads responses from child process stdout.
 * Behavioral parity with Kotlin StdioJsonRpc.kt.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StdioJsonRpc = void 0;
const readline = __importStar(require("readline"));
class StdioJsonRpc {
    nextId = 1;
    pending = new Map();
    proc = null;
    rl = null;
    /** Attach to a child process's stdin/stdout. Starts reader. */
    attach(proc) {
        this.proc = proc;
        if (!proc.stdout)
            throw new Error('Process has no stdout');
        this.rl = readline.createInterface({ input: proc.stdout, terminal: false });
        this.rl.on('line', (line) => this.handleIncoming(line));
    }
    /** Detach from process — close reader, reject pending. */
    detach() {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
        this.proc = null;
        this.rejectAll('Connection closed');
    }
    /** Send JSON-RPC request and await response with timeout. */
    async sendRequest(method, params, timeoutMs) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Timeout after ${timeoutMs}ms waiting for ${method}`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            this.writeMessage({ jsonrpc: '2.0', id, method, params });
        });
    }
    /** Send JSON-RPC notification (no response expected). */
    sendNotification(method, params) {
        this.writeMessage({ jsonrpc: '2.0', method, params });
    }
    /** Reject all pending requests. */
    rejectAll(reason) {
        for (const [, req] of this.pending) {
            clearTimeout(req.timer);
            req.reject(new Error(reason));
        }
        this.pending.clear();
    }
    handleIncoming(line) {
        if (!line.trim())
            return;
        let msg;
        try {
            msg = JSON.parse(line);
        }
        catch {
            return;
        }
        const id = msg.id;
        if (id != null)
            this.resolveResponse(id, msg);
    }
    resolveResponse(id, response) {
        const req = this.pending.get(id);
        if (!req)
            return;
        this.pending.delete(id);
        clearTimeout(req.timer);
        if (response.error) {
            req.reject(new Error(response.error.message ?? 'Unknown error'));
        }
        else {
            req.resolve(response.result);
        }
    }
    writeMessage(msg) {
        if (!this.proc?.stdin)
            throw new Error('Not attached to process');
        this.proc.stdin.write(JSON.stringify(msg) + '\n');
    }
}
exports.StdioJsonRpc = StdioJsonRpc;
//# sourceMappingURL=rpc.js.map