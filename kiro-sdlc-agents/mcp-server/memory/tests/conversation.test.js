"use strict";
/**
 * Unit tests for Structured Conversation History (F2).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const conversation_repo_js_1 = require("../conversation-repo.js");
const conversation_summarizer_js_1 = require("../conversation-summarizer.js");
const knowledge_repo_js_1 = require("../knowledge-repo.js");
const schema_js_1 = require("../schema.js");
const migrations_v3_js_1 = require("../migrations-v3.js");
function createTestDb() {
    const db = new better_sqlite3_1.default(':memory:');
    db.exec(schema_js_1.MEMORY_SCHEMA);
    (0, migrations_v3_js_1.runV3Migrations)(db);
    return db;
}
(0, node_test_1.describe)('ConversationRepository', () => {
    let db;
    let repo;
    (0, node_test_1.beforeEach)(() => {
        db = createTestDb();
        repo = new conversation_repo_js_1.ConversationRepository(db);
        // Create a session for FK constraint
        db.prepare("INSERT INTO memory_sessions (session_id, status) VALUES ('sess-1', 'active')").run();
    });
    (0, node_test_1.describe)('saveTurn', () => {
        (0, node_test_1.it)('should save a turn and return ID', () => {
            const id = repo.saveTurn('sess-1', 'user', 'Hello world');
            (0, strict_1.default)(id > 0);
        });
        (0, node_test_1.it)('should auto-increment turn numbers', () => {
            repo.saveTurn('sess-1', 'user', 'First');
            repo.saveTurn('sess-1', 'assistant', 'Second');
            const turns = repo.getSession('sess-1');
            strict_1.default.equal(turns[0].turn_number, 1);
            strict_1.default.equal(turns[1].turn_number, 2);
        });
        (0, node_test_1.it)('should store tool_calls as JSON', () => {
            repo.saveTurn('sess-1', 'assistant', 'Calling tool', [{ name: 'mem_search', args: { query: 'test' } }]);
            const turns = repo.getSession('sess-1');
            const toolCalls = JSON.parse(turns[0].tool_calls);
            strict_1.default.equal(toolCalls[0].name, 'mem_search');
        });
    });
    (0, node_test_1.describe)('getSession', () => {
        (0, node_test_1.it)('should return empty array for unknown session', () => {
            const turns = repo.getSession('unknown');
            strict_1.default.equal(turns.length, 0);
        });
        (0, node_test_1.it)('should return turns in order', () => {
            repo.saveTurn('sess-1', 'user', 'A');
            repo.saveTurn('sess-1', 'assistant', 'B');
            repo.saveTurn('sess-1', 'user', 'C');
            const turns = repo.getSession('sess-1');
            strict_1.default.equal(turns.length, 3);
            strict_1.default.equal(turns[0].content, 'A');
            strict_1.default.equal(turns[2].content, 'C');
        });
        (0, node_test_1.it)('should respect limit', () => {
            for (let i = 0; i < 10; i++) {
                repo.saveTurn('sess-1', 'user', `Turn ${i}`);
            }
            const turns = repo.getSession('sess-1', 5);
            strict_1.default.equal(turns.length, 5);
        });
    });
    (0, node_test_1.describe)('listSessions', () => {
        (0, node_test_1.it)('should list sessions with turn counts', () => {
            repo.saveTurn('sess-1', 'user', 'Hello');
            repo.saveTurn('sess-1', 'assistant', 'Hi');
            const sessions = repo.listSessions();
            strict_1.default.equal(sessions.length, 1);
            strict_1.default.equal(sessions[0].session_id, 'sess-1');
            strict_1.default.equal(sessions[0].turn_count, 2);
            (0, strict_1.default)(sessions[0].roles.includes('user'));
            (0, strict_1.default)(sessions[0].roles.includes('assistant'));
        });
    });
    (0, node_test_1.describe)('searchTurns', () => {
        (0, node_test_1.it)('should find turns by content', () => {
            repo.saveTurn('sess-1', 'user', 'How to implement authentication?');
            repo.saveTurn('sess-1', 'assistant', 'Use JWT tokens');
            const results = repo.searchTurns('authentication');
            strict_1.default.equal(results.length, 1);
            strict_1.default.match(results[0].content, /authentication/);
        });
        (0, node_test_1.it)('should return empty for no match', () => {
            repo.saveTurn('sess-1', 'user', 'Hello');
            const results = repo.searchTurns('nonexistent');
            strict_1.default.equal(results.length, 0);
        });
    });
    (0, node_test_1.describe)('getSessionTurnCount', () => {
        (0, node_test_1.it)('should return correct count', () => {
            repo.saveTurn('sess-1', 'user', 'A');
            repo.saveTurn('sess-1', 'assistant', 'B');
            strict_1.default.equal(repo.getSessionTurnCount('sess-1'), 2);
        });
        (0, node_test_1.it)('should return 0 for empty session', () => {
            strict_1.default.equal(repo.getSessionTurnCount('empty'), 0);
        });
    });
});
(0, node_test_1.describe)('ConversationSummarizer', () => {
    let db;
    let convRepo;
    let knowledgeRepo;
    let summarizer;
    (0, node_test_1.beforeEach)(() => {
        db = createTestDb();
        convRepo = new conversation_repo_js_1.ConversationRepository(db);
        knowledgeRepo = new knowledge_repo_js_1.KnowledgeRepository(db);
        summarizer = new conversation_summarizer_js_1.ConversationSummarizer(convRepo, knowledgeRepo, 5);
        db.prepare("INSERT INTO memory_sessions (session_id, status) VALUES ('sess-1', 'active')").run();
    });
    (0, node_test_1.it)('should summarize session into knowledge entry', () => {
        convRepo.saveTurn('sess-1', 'user', 'What is the architecture?');
        convRepo.saveTurn('sess-1', 'assistant', 'It uses microservices');
        const result = summarizer.summarizeSession('sess-1');
        (0, strict_1.default)(result !== null);
        strict_1.default.equal(result.turnsProcessed, 2);
        (0, strict_1.default)(result.summaryEntryId > 0);
        // Verify entry was created
        const entry = knowledgeRepo.findById(result.summaryEntryId);
        (0, strict_1.default)(entry !== undefined);
        strict_1.default.equal(entry.type, 'CONVERSATION');
        strict_1.default.equal(entry.tier, 'EPISODIC');
    });
    (0, node_test_1.it)('should detect when summarization is needed', () => {
        for (let i = 0; i < 5; i++) {
            convRepo.saveTurn('sess-1', 'user', `Turn ${i}`);
        }
        strict_1.default.equal(summarizer.needsSummarization('sess-1'), true);
    });
    (0, node_test_1.it)('should not need summarization for short sessions', () => {
        convRepo.saveTurn('sess-1', 'user', 'Short');
        strict_1.default.equal(summarizer.needsSummarization('sess-1'), false);
    });
    (0, node_test_1.it)('should return null for empty session', () => {
        const result = summarizer.summarizeSession('empty');
        strict_1.default.equal(result, null);
    });
});
//# sourceMappingURL=conversation.test.js.map