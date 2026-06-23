/**
 * Unit tests for Structured Conversation History (F2).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ConversationRepository } from '../conversation-repo.js';
import { ConversationSummarizer } from '../conversation-summarizer.js';
import { KnowledgeRepository } from '../knowledge-repo.js';
import { MEMORY_SCHEMA } from '../schema.js';
import { runV3Migrations } from '../migrations-v3.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(MEMORY_SCHEMA);
  runV3Migrations(db);
  return db;
}

describe('ConversationRepository', () => {
  let db: Database.Database;
  let repo: ConversationRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new ConversationRepository(db);
    // Create a session for FK constraint
    db.prepare(
      "INSERT INTO memory_sessions (session_id, status) VALUES ('sess-1', 'active')"
    ).run();
  });

  describe('saveTurn', () => {
    it('should save a turn and return ID', () => {
      const id = repo.saveTurn('sess-1', 'user', 'Hello world');
      assert(id > 0);
    });

    it('should auto-increment turn numbers', () => {
      repo.saveTurn('sess-1', 'user', 'First');
      repo.saveTurn('sess-1', 'assistant', 'Second');
      const turns = repo.getSession('sess-1');
      assert.equal(turns[0].turn_number, 1);
      assert.equal(turns[1].turn_number, 2);
    });

    it('should store tool_calls as JSON', () => {
      repo.saveTurn('sess-1', 'assistant', 'Calling tool', [{ name: 'mem_search', args: { query: 'test' } }]);
      const turns = repo.getSession('sess-1');
      const toolCalls = JSON.parse(turns[0].tool_calls!);
      assert.equal(toolCalls[0].name, 'mem_search');
    });
  });

  describe('getSession', () => {
    it('should return empty array for unknown session', () => {
      const turns = repo.getSession('unknown');
      assert.equal(turns.length, 0);
    });

    it('should return turns in order', () => {
      repo.saveTurn('sess-1', 'user', 'A');
      repo.saveTurn('sess-1', 'assistant', 'B');
      repo.saveTurn('sess-1', 'user', 'C');
      const turns = repo.getSession('sess-1');
      assert.equal(turns.length, 3);
      assert.equal(turns[0].content, 'A');
      assert.equal(turns[2].content, 'C');
    });

    it('should respect limit', () => {
      for (let i = 0; i < 10; i++) {
        repo.saveTurn('sess-1', 'user', `Turn ${i}`);
      }
      const turns = repo.getSession('sess-1', 5);
      assert.equal(turns.length, 5);
    });
  });

  describe('listSessions', () => {
    it('should list sessions with turn counts', () => {
      repo.saveTurn('sess-1', 'user', 'Hello');
      repo.saveTurn('sess-1', 'assistant', 'Hi');
      const sessions = repo.listSessions();
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].session_id, 'sess-1');
      assert.equal(sessions[0].turn_count, 2);
      assert(sessions[0].roles.includes('user'));
      assert(sessions[0].roles.includes('assistant'));
    });
  });

  describe('searchTurns', () => {
    it('should find turns by content', () => {
      repo.saveTurn('sess-1', 'user', 'How to implement authentication?');
      repo.saveTurn('sess-1', 'assistant', 'Use JWT tokens');
      const results = repo.searchTurns('authentication');
      assert.equal(results.length, 1);
      assert.match(results[0].content, /authentication/);
    });

    it('should return empty for no match', () => {
      repo.saveTurn('sess-1', 'user', 'Hello');
      const results = repo.searchTurns('nonexistent');
      assert.equal(results.length, 0);
    });
  });

  describe('getSessionTurnCount', () => {
    it('should return correct count', () => {
      repo.saveTurn('sess-1', 'user', 'A');
      repo.saveTurn('sess-1', 'assistant', 'B');
      assert.equal(repo.getSessionTurnCount('sess-1'), 2);
    });

    it('should return 0 for empty session', () => {
      assert.equal(repo.getSessionTurnCount('empty'), 0);
    });
  });
});

describe('ConversationSummarizer', () => {
  let db: Database.Database;
  let convRepo: ConversationRepository;
  let knowledgeRepo: KnowledgeRepository;
  let summarizer: ConversationSummarizer;

  beforeEach(() => {
    db = createTestDb();
    convRepo = new ConversationRepository(db);
    knowledgeRepo = new KnowledgeRepository(db);
    summarizer = new ConversationSummarizer(convRepo, knowledgeRepo, 5);
    db.prepare(
      "INSERT INTO memory_sessions (session_id, status) VALUES ('sess-1', 'active')"
    ).run();
  });

  it('should summarize session into knowledge entry', () => {
    convRepo.saveTurn('sess-1', 'user', 'What is the architecture?');
    convRepo.saveTurn('sess-1', 'assistant', 'It uses microservices');
    const result = summarizer.summarizeSession('sess-1');
    assert(result !== null);
    assert.equal(result!.turnsProcessed, 2);
    assert(result!.summaryEntryId > 0);
    // Verify entry was created
    const entry = knowledgeRepo.findById(result!.summaryEntryId);
    assert(entry !== undefined);
    assert.equal(entry!.type, 'CONVERSATION');
    assert.equal(entry!.tier, 'EPISODIC');
  });

  it('should detect when summarization is needed', () => {
    for (let i = 0; i < 5; i++) {
      convRepo.saveTurn('sess-1', 'user', `Turn ${i}`);
    }
    assert.equal(summarizer.needsSummarization('sess-1'), true);
  });

  it('should not need summarization for short sessions', () => {
    convRepo.saveTurn('sess-1', 'user', 'Short');
    assert.equal(summarizer.needsSummarization('sess-1'), false);
  });

  it('should return null for empty session', () => {
    const result = summarizer.summarizeSession('empty');
    assert.equal(result, null);
  });
});
