/**
 * CCR Store — Context Compression and Retrieval (SQLite)
 * KSA-244: Persists original content for on-demand retrieval by LLM
 * 
 * TTL: 1 hour, Max entries: 1000, Eviction: LRU
 * Budget: < 2ms per store/retrieve operation.
 */

import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { CCREntry } from './types.js';

export class CCRStore {
  private storeStmt: any;
  private retrieveStmt: any;
  private updateAccessStmt: any;
  private countStmt: any;
  private evictStmt: any;
  private cleanupStmt: any;
  private storeCount = 0;

  constructor(
    private db: Database.Database,
    private maxEntries: number = 1000,
    private ttlMs: number = 3_600_000, // 1 hour
  ) {
    this.initTable();
    this.prepareStatements();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ccr_store (
        key TEXT PRIMARY KEY,
        original TEXT NOT NULL,
        content_type TEXT NOT NULL,
        compressed_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_accessed INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ccr_expires ON ccr_store(expires_at);
      CREATE INDEX IF NOT EXISTS idx_ccr_lru ON ccr_store(last_accessed);
    `);
  }

  private prepareStatements(): void {
    this.storeStmt = this.db.prepare(
      `INSERT OR REPLACE INTO ccr_store (key, original, content_type, compressed_at, expires_at, last_accessed, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.retrieveStmt = this.db.prepare(
      `SELECT * FROM ccr_store WHERE key = ? AND expires_at > ?`
    );
    this.updateAccessStmt = this.db.prepare(
      `UPDATE ccr_store SET last_accessed = ? WHERE key = ?`
    );
    this.countStmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM ccr_store`);
    this.evictStmt = this.db.prepare(
      `DELETE FROM ccr_store WHERE key IN (SELECT key FROM ccr_store ORDER BY last_accessed ASC LIMIT ?)`
    );
    this.cleanupStmt = this.db.prepare(
      `DELETE FROM ccr_store WHERE expires_at <= ?`
    );
  }

  /**
   * Store original content and return a retrieval key.
   * BR-23: Key is crypto.randomUUID()
   */
  store(original: string, contentType: string): string {
    const key = crypto.randomUUID();
    const now = Date.now();

    this.evictIfNeeded();

    this.storeStmt.run(
      key,
      original,
      contentType,
      now,
      now + this.ttlMs,
      now,
      Buffer.byteLength(original, 'utf8'),
    );

    // BR-24: Lazy cleanup every 100 stores
    this.storeCount++;
    if (this.storeCount % 100 === 0) {
      this.cleanup();
    }

    return key;
  }

  /**
   * Retrieve original content by key.
   * Returns null if expired or not found.
   */
  retrieve(key: string): CCREntry | null {
    const now = Date.now();
    const row = this.retrieveStmt.get(key, now) as any;

    if (!row) return null;

    // Update last_accessed
    this.updateAccessStmt.run(now, key);

    return {
      key: row.key,
      original: row.original,
      contentType: row.content_type,
      compressedAt: row.compressed_at,
      expiresAt: row.expires_at,
      lastAccessed: now,
      sizeBytes: row.size_bytes,
    };
  }

  /**
   * BR-22: Evict LRU entries if at capacity.
   */
  private evictIfNeeded(): void {
    const { cnt } = this.countStmt.get() as { cnt: number };
    if (cnt >= this.maxEntries) {
      const toEvict = cnt - this.maxEntries + 1;
      this.evictStmt.run(toEvict);
    }
  }

  /**
   * Remove expired entries.
   */
  private cleanup(): void {
    this.cleanupStmt.run(Date.now());
  }
}
