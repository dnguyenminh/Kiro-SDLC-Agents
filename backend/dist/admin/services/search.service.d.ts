import { AdminModuleDependencies } from '../index.js';
export interface SearchRequest {
    query: string;
    tier?: string;
    tags?: string[];
    limit?: number;
    includeScoreBreakdown?: boolean;
}
export declare function createSearchService(deps: AdminModuleDependencies): {
    search(request: SearchRequest): {
        query: string;
        results: any;
        total: any;
        searchTimeMs: number;
        error?: undefined;
    } | {
        query: string;
        results: never[];
        total: number;
        searchTimeMs: number;
        error: any;
    };
};
