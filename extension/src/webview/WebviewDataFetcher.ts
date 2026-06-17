/**
 * WebviewDataFetcher — fetches data from Backend /api/* endpoints for Webview panels.
 */

import type { HttpClient } from '../proxy/HttpClient';

export interface DashboardSummary {
  totalEntries: number;
  recentCount: number;
  topCategories: string[];
}

export interface KBGraphData {
  nodes: Array<{ id: string; title: string; type: string }>;
  edges: Array<{ from: string; to: string; relation: string }>;
}

export class WebviewDataFetcher {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const result = await this.httpClient.fetchWebviewData('/api/dashboard/summary') as { data: DashboardSummary };
    return result.data;
  }

  async getKBGraph(): Promise<KBGraphData> {
    const result = await this.httpClient.fetchWebviewData('/api/kb/graph') as { data: KBGraphData };
    return result.data;
  }

  async getAnalyticsOverview(): Promise<unknown> {
    const result = await this.httpClient.fetchWebviewData('/api/analytics/overview') as { data: unknown };
    return result.data;
  }

  async getTagsList(): Promise<unknown> {
    const result = await this.httpClient.fetchWebviewData('/api/tags/list') as { data: unknown };
    return result.data;
  }

  async getQualitySummary(): Promise<unknown> {
    const result = await this.httpClient.fetchWebviewData('/api/quality/summary') as { data: unknown };
    return result.data;
  }
}
