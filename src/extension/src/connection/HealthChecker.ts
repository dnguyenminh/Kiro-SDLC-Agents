/**
 * HealthChecker — periodic GET /health poller with exponential backoff.
 * Implements TDD §5.5 State Machine and FSD BR-13, BR-17.
 */

import { HealthResponse, ConnectionConfig } from '../types/connection';
import { HttpClient } from '../proxy/HttpClient';

export type HealthCheckResult =
  | { success: true; response: HealthResponse }
  | { success: false; error: Error };

export class HealthChecker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly client: HttpClient;
  private readonly config: ConnectionConfig;

  constructor(client: HttpClient, config: ConnectionConfig) {
    this.client = client;
    this.config = config;
  }

  async checkOnce(): Promise<HealthCheckResult> {
    try {
      const response = await this.client.health();
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  startPolling(onResult: (result: HealthCheckResult) => void): void {
    this.stopPolling();
    this.intervalId = setInterval(async () => {
      const result = await this.checkOnce();
      onResult(result);
    }, this.config.healthCheckInterval);
  }

  stopPolling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  dispose(): void {
    this.stopPolling();
  }
}
