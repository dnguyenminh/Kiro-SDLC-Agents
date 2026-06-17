/**
 * WebviewDataFetcher — fetches JSON data from Backend /api/* endpoints.
 * Implements TDD §5.1 WebviewDataFetcher, FSD BR-23.
 */

import { ConnectionManager } from '../connection/ConnectionManager';

export class WebviewDataFetcher {
  private readonly connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  async fetch<T>(path: string): Promise<T | null> {
    if (!this.connectionManager.isConnected()) {
      return null;
    }

    try {
      const client = this.connectionManager.getHttpClient();
      return await client.fetchWebviewData<T>(path);
    } catch {
      return null;
    }
  }

  async post<T>(path: string, body: unknown): Promise<T | null> {
    if (!this.connectionManager.isConnected()) {
      return null;
    }

    try {
      const client = this.connectionManager.getHttpClient();
      return await client.postWebviewData<T>(path, body);
    } catch {
      return null;
    }
  }
}
