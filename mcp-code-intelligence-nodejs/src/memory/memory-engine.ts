/**
 * MemoryEngine — facade for the SDLC Memory system.
 * Single entry point for all memory operations.
 */

import Database from 'better-sqlite3';
import { MemoryDatabaseManager } from './memory-db.js';
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

export class MemoryEngine {
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

  private readonly _db: Database.Database;
  private currentSessionId: string | null = null;

  /** Expose raw DB for direct queries (used by UX routes). */
  get db(): Database.Database { return this._db; }

  constructor(db: Database.Database) {
    this._db = db;
    const memDb = new MemoryDatabaseManager(db);
    memDb.initialize();

    this.knowledge = new KnowledgeRepository(db);
    this.search = new KnowledgeSearchRepository(db);
    this.graphRepo = new GraphRepository(db);
    this.vectors = new VectorRepository(db);
    this.consolidation = new ConsolidationRepository(db);
    this.sessions = new SessionRepository(db);
    this.audit = new AuditRepository(db);
    this.graph = new KnowledgeGraph(this.graphRepo);
    this.graph.loadFromDb();
    this.coreMemory = new CoreMemoryManager(db);
    this.entities = new EntityRepository(db);
    this.conversations = new ConversationRepository(db);
  }

  /** Start a new session. */
  startSession(agentName?: string): string {
    const sid = this.sessions.startSession(agentName);
    this.currentSessionId = sid;
    this.audit.log('SESSION_START', undefined, sid);
    return sid;
  }

  /** End the current session. */
  endSession(): void {
    if (!this.currentSessionId) return;
    this.sessions.endSession(this.currentSessionId);
    this.audit.log('SESSION_END', undefined, this.currentSessionId);
    this.currentSessionId = null;
  }

  /** Get current session ID. */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /** Get overall memory statistics. */
  getStats(): MemoryStats {
    const tierBreakdown = this.consolidation.getTierStats();
    const totalEntries = tierBreakdown.reduce((sum, t) => sum + t.entryCount, 0);
    return {
      totalEntries,
      totalEdges: this.graphRepo.countEdges(),
      totalVectors: this.vectors.count(),
      tierBreakdown,
    };
  }
}
