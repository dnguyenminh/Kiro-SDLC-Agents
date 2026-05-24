/**
 * MemoryEngine — facade for the SDLC Memory system.
 * Single entry point for all memory operations.
 */
import Database from 'better-sqlite3';
import { KnowledgeRepository } from './knowledge-repo.js';
import { KnowledgeSearchRepository } from './search-repo.js';
import { GraphRepository } from './graph-repo.js';
import { VectorRepository } from './vector-repo.js';
import { ConsolidationRepository } from './consolidation-repo.js';
import { SessionRepository } from './session-repo.js';
import { AuditRepository } from './audit-repo.js';
import { KnowledgeGraph } from './knowledge-graph.js';
import { CoreMemoryManager } from './core-memory.js';
import { EntityRepository } from './entity-repo.js';
import { ConversationRepository } from './conversation-repo.js';
import { TierStats } from './models.js';
export interface MemoryStats {
    totalEntries: number;
    totalEdges: number;
    totalVectors: number;
    tierBreakdown: TierStats[];
}
export declare class MemoryEngine {
    readonly knowledge: KnowledgeRepository;
    readonly search: KnowledgeSearchRepository;
    readonly graphRepo: GraphRepository;
    readonly vectors: VectorRepository;
    readonly consolidation: ConsolidationRepository;
    readonly sessions: SessionRepository;
    readonly audit: AuditRepository;
    readonly graph: KnowledgeGraph;
    readonly coreMemory: CoreMemoryManager;
    readonly entities: EntityRepository;
    readonly conversations: ConversationRepository;
    private readonly _db;
    private currentSessionId;
    /** Expose raw DB for direct queries (used by UX routes). */
    get db(): Database.Database;
    constructor(db: Database.Database);
    /** Start a new session. */
    startSession(agentName?: string): string;
    /** End the current session. */
    endSession(): void;
    /** Get current session ID. */
    getSessionId(): string | null;
    /** Get overall memory statistics. */
    getStats(): MemoryStats;
}
//# sourceMappingURL=memory-engine.d.ts.map