/**
 * HealthChecker — dedicated health check polling logic.
 * Uses exponential backoff strategy for retries.
 */

import type { HttpClient } from '../proxy/HttpClient';
import type { HealthResponse } from '../types/connection';

export interface HealthCheckResult {
  healthy: boolean;
  response?: HealthResponse;
  error?: string;
}

export class HealthChecker {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  async check(): Promise<HealthCheckResult> {
    try {
      const response = await this.httpClient.healthCheck();
      return {
        healthy: response.status === 'healthy',
        response: response as HealthResponse,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { healthy: false, error: message };
    }
  }

  /**
   * Calculate next backoff delay using exponential strategy.
   * Pattern: 1s, 2s, 4s, 8s, 16s, max 30s
   */
  static calculateBackoff(currentDelay: number): number {
    return Math.min(currentDelay * 2, 30000);
  }
}
