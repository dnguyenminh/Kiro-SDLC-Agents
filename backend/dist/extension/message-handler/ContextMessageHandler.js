/**
 * ContextMessageHandler — Handles webview messages for context menu
 * KSA-252
 */
export class ContextMessageHandler {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    /**
     * Process an incoming message from the webview.
     * Returns a response to send back, or null if the message is not a context request.
     */
    async handle(message) {
        if (!this.isContextRequest(message)) {
            return null;
        }
        return this.resolver.handleMessage(message);
    }
    isContextRequest(message) {
        if (!message || typeof message !== 'object')
            return false;
        const msg = message;
        const contextTypes = [
            'getWorkspaceFileTree',
            'getWorkspaceFolderTree',
            'getSpecList',
            'getSteeringFiles',
            'getMcpResources',
            'getActiveFileName',
            'resolveGitDiff',
            'resolveTerminalOutput',
            'resolveDiagnostics',
            'resolveFileContent',
            'resolveSpecContent',
            'resolveSteeringContent',
            'resolveMcpResource',
            'resolveFolderListing',
        ];
        return contextTypes.includes(msg.type);
    }
    dispose() {
        this.resolver.dispose();
    }
}
//# sourceMappingURL=ContextMessageHandler.js.map