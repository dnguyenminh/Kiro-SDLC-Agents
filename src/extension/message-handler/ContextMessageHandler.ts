/**
 * ContextMessageHandler — Handles webview messages for context menu
 * KSA-252
 */

import type { ContextRequest, ContextResponse } from '../../shared/protocol';
import { ContextResolverProvider } from '../providers/ContextResolverProvider';

export class ContextMessageHandler {
  private resolver: ContextResolverProvider;

  constructor(resolver: ContextResolverProvider) {
    this.resolver = resolver;
  }

  /**
   * Process an incoming message from the webview.
   * Returns a response to send back, or null if the message is not a context request.
   */
  async handle(message: unknown): Promise<ContextResponse | null> {
    if (!this.isContextRequest(message)) {
      return null;
    }
    return this.resolver.handleMessage(message as ContextRequest);
  }

  private isContextRequest(message: unknown): boolean {
    if (!message || typeof message !== 'object') return false;
    const msg = message as Record<string, unknown>;
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
    return contextTypes.includes(msg.type as string);
  }

  dispose(): void {
    this.resolver.dispose();
  }
}
