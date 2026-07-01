/**
 * ContextMessageHandler — Handles webview messages for context menu
 * KSA-252
 */
import type { ContextResponse } from '../../shared/protocol';
import { ContextResolverProvider } from '../providers/ContextResolverProvider';
export declare class ContextMessageHandler {
    private resolver;
    constructor(resolver: ContextResolverProvider);
    /**
     * Process an incoming message from the webview.
     * Returns a response to send back, or null if the message is not a context request.
     */
    handle(message: unknown): Promise<ContextResponse | null>;
    private isContextRequest;
    dispose(): void;
}
