"use strict";
/**
 * CCR Store — Context Compression and Retrieval (SQLite)
 * KSA-244: Persists original content for on-demand retrieval by LLM
 *
 * TTL: 1 hour, Max entries: 1000, Eviction: LRU
 * Budget: < 2ms per store/retrieve operation.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CCRStore = void 0;
const crypto = __importStar(require("crypto"));
class CCRStore {
    db;
    maxEntries;
    ttlMs;
    storeStmt;
    retrieveStmt;
    updateAccessStmt;
    countStmt;
    evictStmt;
    cleanupStmt;
    storeCount = 0;
    constructor(db, maxEntries = 1000, ttlMs = 3_600_000) {
        this.db = db;
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
        this.initTable();
        this.prepareStatements();
    }
    initTable() {
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
    prepareStatements() {
        this.storeStmt = this.db.prepare(`INSERT OR REPLACE INTO ccr_store (key, original, content_type, compressed_at, expires_at, last_accessed, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`);
        this.retrieveStmt = this.db.prepare(`SELECT * FROM ccr_store WHERE key = ? AND expires_at > ?`);
        this.updateAccessStmt = this.db.prepare(`UPDATE ccr_store SET last_accessed = ? WHERE key = ?`);
        this.countStmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM ccr_store`);
        this.evictStmt = this.db.prepare(`DELETE FROM ccr_store WHERE key IN (SELECT key FROM ccr_store ORDER BY last_accessed ASC LIMIT ?)`);
        this.cleanupStmt = this.db.prepare(`DELETE FROM ccr_store WHERE expires_at <= ?`);
    }
    /**
     * Store original content and return a retrieval key.
     * BR-23: Key is crypto.randomUUID()
     */
    store(original, contentType) {
        const key = crypto.randomUUID();
        const now = Date.now();
        this.evictIfNeeded();
        this.storeStmt.run(key, original, contentType, now, now + this.ttlMs, now, Buffer.byteLength(original, 'utf8'));
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
    retrieve(key) {
        const now = Date.now();
        const row = this.retrieveStmt.get(key, now);
        if (!row)
            return null;
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
    evictIfNeeded() {
        const { cnt } = this.countStmt.get();
        if (cnt >= this.maxEntries) {
            const toEvict = cnt - this.maxEntries + 1;
            this.evictStmt.run(toEvict);
        }
    }
    /**
     * Remove expired entries.
     */
    cleanup() {
        this.cleanupStmt.run(Date.now());
    }
}
exports.CCRStore = CCRStore;
//# sourceMappingURL=ccr-store.js.map