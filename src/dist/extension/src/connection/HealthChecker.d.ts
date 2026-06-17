/**
 * HealthChecker — periodic GET /health poller with exponential backoff.
 * Implements TDD §5.5 State Machine and FSD BR-13, BR-17.
 */
import { HealthResponse, ConnectionConfig } from '../types/connection';
import { HttpClient } from '../proxy/HttpClient';
export type HealthCheckResult = {
    success: true;
    response: HealthResponse;
} | {
    success: false;
    error: Error;
};
export declare class HealthChecker {
    private intervalId;
    private readonly client;
    private readonly config;
    constructor(client: HttpClient, config: ConnectionConfig);
    checkOnce(): Promise<HealthCheckResult>;
    startPolling(onResult: (result: HealthCheckResult) => void): void;
    stopPolling(): void;
    dispose(): void;
}
//# sourceMappingURL=HealthChecker.d.ts.map