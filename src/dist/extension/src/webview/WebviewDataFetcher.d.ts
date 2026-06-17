/**
 * WebviewDataFetcher — fetches JSON data from Backend /api/* endpoints.
 * Implements TDD §5.1 WebviewDataFetcher, FSD BR-23.
 */
import { ConnectionManager } from '../connection/ConnectionManager';
export declare class WebviewDataFetcher {
    private readonly connectionManager;
    constructor(connectionManager: ConnectionManager);
    fetch<T>(path: string): Promise<T | null>;
    post<T>(path: string, body: unknown): Promise<T | null>;
}
//# sourceMappingURL=WebviewDataFetcher.d.ts.map