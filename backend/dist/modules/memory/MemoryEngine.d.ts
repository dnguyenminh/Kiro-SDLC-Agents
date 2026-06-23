/**
 * MemoryEngine — facade for the KB Memory system.
 * Single entry point for all memory operations in the backend.
 */
import Database from 'better-sqlite3';
import type { KnowledgeEntry, SearchResult, GraphEdge } from './models.js';
export declare class MemoryEngine {
    private readonly db;
    private currentSessionId;
    constructor(db: Database.Database);
    getDb(): Database.Database;
    getSessionId(): string | null;
    insert(entry: Partial<KnowledgeEntry>): number;
    findById(id: number): KnowledgeEntry | undefined;
    findFiltered(tier?: string, type?: string, limit?: number): KnowledgeEntry[];
    deleteEntry(id: number): void;
    recordAccess(id: number): void;
    search(query: string, limit?: number, tier?: string, type?: string): SearchResult[];
    addEdge(sourceId: number, targetId: number, relation?: string, weight?: number): number;
    getNeighbors(nodeId: number): GraphEdge[];
    countEdges(): number;
    startSession(agentName?: string): string;
    endSession(): void;
    listSessions(limit?: number): any[];
    auditLog(operation: string, entryId?: number, sessionId?: string): void;
    listAudit(limit?: number, operation?: string): any[];
}
