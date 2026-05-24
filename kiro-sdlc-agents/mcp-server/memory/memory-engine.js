"use strict";
/**
 * MemoryEngine — facade for the SDLC Memory system.
 * Single entry point for all memory operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryEngine = void 0;
const memory_db_js_1 = require("./memory-db.js");
const knowledge_repo_js_1 = require("./knowledge-repo.js");
const search_repo_js_1 = require("./search-repo.js");
const graph_repo_js_1 = require("./graph-repo.js");
const vector_repo_js_1 = require("./vector-repo.js");
const consolidation_repo_js_1 = require("./consolidation-repo.js");
const session_repo_js_1 = require("./session-repo.js");
const audit_repo_js_1 = require("./audit-repo.js");
const knowledge_graph_js_1 = require("./knowledge-graph.js");
const core_memory_js_1 = require("./core-memory.js");
const entity_repo_js_1 = require("./entity-repo.js");
const conversation_repo_js_1 = require("./conversation-repo.js");
class MemoryEngine {
    knowledge;
    search;
    graphRepo;
    vectors;
    consolidation;
    sessions;
    audit;
    graph;
    coreMemory;
    entities;
    conversations;
    _db;
    currentSessionId = null;
    /** Expose raw DB for direct queries (used by UX routes). */
    get db() { return this._db; }
    constructor(db) {
        this._db = db;
        const memDb = new memory_db_js_1.MemoryDatabaseManager(db);
        memDb.initialize();
        this.knowledge = new knowledge_repo_js_1.KnowledgeRepository(db);
        this.search = new search_repo_js_1.KnowledgeSearchRepository(db);
        this.graphRepo = new graph_repo_js_1.GraphRepository(db);
        this.vectors = new vector_repo_js_1.VectorRepository(db);
        this.consolidation = new consolidation_repo_js_1.ConsolidationRepository(db);
        this.sessions = new session_repo_js_1.SessionRepository(db);
        this.audit = new audit_repo_js_1.AuditRepository(db);
        this.graph = new knowledge_graph_js_1.KnowledgeGraph(this.graphRepo);
        this.graph.loadFromDb();
        this.coreMemory = new core_memory_js_1.CoreMemoryManager(db);
        this.entities = new entity_repo_js_1.EntityRepository(db);
        this.conversations = new conversation_repo_js_1.ConversationRepository(db);
    }
    /** Start a new session. */
    startSession(agentName) {
        const sid = this.sessions.startSession(agentName);
        this.currentSessionId = sid;
        this.audit.log('SESSION_START', undefined, sid);
        return sid;
    }
    /** End the current session. */
    endSession() {
        if (!this.currentSessionId)
            return;
        this.sessions.endSession(this.currentSessionId);
        this.audit.log('SESSION_END', undefined, this.currentSessionId);
        this.currentSessionId = null;
    }
    /** Get current session ID. */
    getSessionId() {
        return this.currentSessionId;
    }
    /** Get overall memory statistics. */
    getStats() {
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
exports.MemoryEngine = MemoryEngine;
//# sourceMappingURL=memory-engine.js.map