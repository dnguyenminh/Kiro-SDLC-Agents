"use strict";
/**
 * KSA-169: Incremental Updater — Detect file changes using FNV-1a content hashing.
 * Compares disk state against stored file_index to determine what needs re-indexing.
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
exports.IncrementalUpdater = void 0;
exports.fnv1aHash = fnv1aHash;
const fs = __importStar(require("fs"));
class IncrementalUpdater {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Scan workspace and compare against stored file index. */
    scanChanges(files) {
        const result = { added: [], modified: [], deleted: [], unchanged: 0 };
        const indexedPaths = new Set();
        const rows = this.db.prepare('SELECT path, content_hash, mtime FROM file_index').all();
        const indexMap = new Map(rows.map(r => [r.path, r]));
        for (const r of rows)
            indexedPaths.add(r.path);
        for (const file of files) {
            const indexed = indexMap.get(file.relativePath);
            if (!indexed) {
                result.added.push(file.relativePath);
                continue;
            }
            indexedPaths.delete(file.relativePath);
            try {
                const stat = fs.statSync(file.absolutePath);
                const mtime = Math.floor(stat.mtimeMs);
                if (mtime !== indexed.mtime) {
                    const content = fs.readFileSync(file.absolutePath);
                    const hash = fnv1aHash(content);
                    if (hash !== indexed.content_hash) {
                        result.modified.push(file.relativePath);
                    }
                    else {
                        this.updateMtime(file.relativePath, mtime);
                        result.unchanged++;
                    }
                }
                else {
                    result.unchanged++;
                }
            }
            catch {
                result.deleted.push(file.relativePath);
            }
        }
        for (const deletedPath of indexedPaths) {
            result.deleted.push(deletedPath);
        }
        return result;
    }
    /** Update file index entry after successful indexing. */
    updateFileIndex(relativePath, absolutePath, symbolCount) {
        try {
            const stat = fs.statSync(absolutePath);
            const content = fs.readFileSync(absolutePath);
            const hash = fnv1aHash(content);
            this.db.prepare(`
        INSERT OR REPLACE INTO file_index (path, mtime, content_hash, size_bytes, last_indexed, symbol_count)
        VALUES (?, ?, ?, ?, datetime('now'), ?)
      `).run(relativePath, Math.floor(stat.mtimeMs), hash, stat.size, symbolCount);
        }
        catch (err) {
            console.error(`[incremental-updater] Failed to update index for ${relativePath}:`, err);
        }
    }
    /** Remove a file from the index. */
    removeFromIndex(relativePath) {
        this.db.prepare('DELETE FROM file_index WHERE path = ?').run(relativePath);
    }
    /** Get total indexed file count. */
    getIndexedCount() {
        const row = this.db.prepare('SELECT COUNT(*) as count FROM file_index').get();
        return row.count;
    }
    updateMtime(relativePath, mtime) {
        this.db.prepare('UPDATE file_index SET mtime = ? WHERE path = ?').run(mtime, relativePath);
    }
}
exports.IncrementalUpdater = IncrementalUpdater;
/** FNV-1a 32-bit hash for fast content comparison. */
function fnv1aHash(data) {
    const FNV_OFFSET = 2166136261;
    const FNV_PRIME = 16777619;
    let hash = FNV_OFFSET;
    for (let i = 0; i < data.length; i++) {
        hash ^= data[i];
        hash = Math.imul(hash, FNV_PRIME) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
//# sourceMappingURL=incremental-updater.js.map