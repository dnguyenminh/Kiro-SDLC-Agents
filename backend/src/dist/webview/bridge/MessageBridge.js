"use strict";
/**
 * MessageBridge — postMessage request/response bridge between webview and extension host
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBridge = void 0;
class MessageBridge {
    pendingRequests = new Map();
    requestId = 0;
    defaultTimeout;
    vscodeApi;
    constructor(vscodeApi, defaultTimeout = 3000) {
        this.vscodeApi = vscodeApi;
        this.defaultTimeout = defaultTimeout;
        window.addEventListener('message', this.handleMessage.bind(this));
    }
    handleMessage(event) {
        const data = event.data;
        if (!data || !('requestId' in data))
            return;
        const pending = this.pendingRequests.get(data.requestId);
        if (!pending)
            return;
        clearTimeout(pending.timer);
        this.pendingRequests.delete(data.requestId);
        if (data.type === 'error') {
            pending.reject(new Error(data.message));
        }
        else {
            pending.resolve(data);
        }
    }
    async request(message, timeout) {
        const id = `ctx-${++this.requestId}`;
        const effectiveTimeout = timeout ?? this.defaultTimeout;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Timeout: ${message.type} (${effectiveTimeout}ms)`));
            }, effectiveTimeout);
            this.pendingRequests.set(id, { resolve: resolve, reject, timer });
            this.vscodeApi.postMessage({ ...message, requestId: id });
        });
    }
    async getFileTree() {
        const response = await this.request({ type: 'getWorkspaceFileTree' });
        return response.data;
    }
    async getSpecList() {
        const response = await this.request({ type: 'getSpecList' });
        return response.data;
    }
    async getFolderTree() {
        const response = await this.request({ type: 'getWorkspaceFolderTree' });
        return response.data;
    }
    async getSteeringFiles() {
        const response = await this.request({ type: 'getSteeringFiles' });
        return response.data;
    }
    async getMcpResources() {
        const response = await this.request({ type: 'getMcpResources' });
        return response.data;
    }
    async getActiveFileName() {
        const response = await this.request({ type: 'getActiveFileName' });
        return response.data;
    }
    async resolveGitDiff() {
        const response = await this.request({ type: 'resolveGitDiff' }, 5000);
        return response.data;
    }
    async resolveTerminalOutput(lines) {
        const response = await this.request({ type: 'resolveTerminalOutput', lines }, 5000);
        return response.data;
    }
    async resolveDiagnostics() {
        const response = await this.request({ type: 'resolveDiagnostics' });
        return response.data;
    }
    dispose() {
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Bridge disposed'));
        }
        this.pendingRequests.clear();
    }
}
exports.MessageBridge = MessageBridge;
//# sourceMappingURL=MessageBridge.js.map