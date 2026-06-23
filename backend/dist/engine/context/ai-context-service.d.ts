/**
 * KSA-158: AI Context Service — intent-aware context assembly with token budgeting.
 * Orchestrates symbol resolution, section fetching, and budget management.
 */
import Database from 'better-sqlite3';
import { SymbolResolver } from '../graph/symbol-resolver.js';
import { CallGraphService } from '../graph/call-graph-service.js';
import { AIContextParams, AIContextResponse } from './types.js';
export declare class AIContextService {
    private db;
    private resolver;
    private callGraph;
    private gitService;
    private workspace;
    constructor(db: Database.Database, resolver: SymbolResolver, callGraph: CallGraphService, workspace: string);
    /** Get intent-aware context for a symbol within token budget. */
    getContext(params: AIContextParams): Promise<AIContextResponse>;
    private fetchSection;
    private fetchSource;
    private fetchCallers;
    private fetchCallees;
    private fetchSiblings;
    private fetchImports;
    private fetchRelatedTests;
    private fetchTypeDefinitions;
    private fetchDocComment;
    private fetchErrorPatterns;
    private fetchRecentChanges;
    private fetchTestPatterns;
    private fetchMocksNeeded;
    private getSymbolEndLine;
    private notFoundResponse;
}
