/**
 * KSA-160: Curated Context Service — NL query → parallel search → RRF merge → budget allocation.
 */
import Database from 'better-sqlite3';
import { SymbolResolver } from '../graph/symbol-resolver.js';
import { GraphTraverser } from '../graph/traverser.js';
import { QueryLayer } from '../query/query-layer.js';
import { CuratedContextParams, CuratedContextResponse } from './types.js';
export declare class CuratedContextService {
    private analyzer;
    private merger;
    private allocator;
    private db;
    private queryLayer;
    private traverser;
    private resolver;
    constructor(db: Database.Database, queryLayer: QueryLayer, traverser: GraphTraverser, resolver: SymbolResolver);
    /** Execute curated context search with NL query. */
    getContext(params: CuratedContextParams): Promise<CuratedContextResponse>;
    private searchCode;
    private searchMemory;
    private expandGraph;
    private miniRRF;
    private formatSections;
}
//# sourceMappingURL=curated-context-service.d.ts.map