/**
 * KSA-159: Edit Context Service — source + callers + tests + git for editing.
 * Gathers everything needed before modifying a symbol.
 */
import Database from 'better-sqlite3';
import { SymbolResolver } from '../graph/symbol-resolver.js';
import { CallGraphService } from '../graph/call-graph-service.js';
import { TestDetector } from '../graph/test-detector.js';
import { EditContextParams, EditContextResult } from './types.js';
export declare class EditContextService {
    private db;
    private resolver;
    private callGraph;
    private testDetector;
    private gitService;
    private budgetManager;
    private workspace;
    constructor(db: Database.Database, resolver: SymbolResolver, callGraph: CallGraphService, testDetector: TestDetector, workspace: string);
    /** Get full edit context for a symbol. */
    getContext(params: EditContextParams): Promise<EditContextResult>;
    private resolveSymbolInput;
    private findSymbolAtLine;
    private readSymbolSource;
    private getSignature;
    private getCallerContext;
    private getLineContext;
    private getTestContext;
    private extractTestBlocks;
    private getGitContext;
    private getSiblingContext;
    private symbolNotFoundResponse;
}
