"use strict";
/**
 * DatabaseManager — SQLite lifecycle management.
 * Handles open, WAL mode, migrations, and graceful close.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
// KSA-175: Lazy-load better-sqlite3 to support prebuilt native binding
let better_sqlite3_1;
function getBetterSqlite3() {
    if (!better_sqlite3_1) {
        try {
            better_sqlite3_1 = require("better-sqlite3");
        } catch (e) {
            // Fallback: resolve from mcp-server/node_modules relative to this file
            const p = require('path');
            const fallbackPath = p.resolve(__dirname, '..', 'node_modules', 'better-sqlite3');
            better_sqlite3_1 = require(fallbackPath);
        }
    }
    return better_sqlite3_1;
}
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const migrations_js_1 = require("./migrations.js");
class DatabaseManager {
    db = null;
    dbPath;
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    /** Open database, enable WAL, run migrations. */
    initialize() {
        this.ensureDirectory();
        // KSA-175: Use prebuilt native binding if provided via environment variable
        const nativeBinding = process.env.BETTER_SQLITE3_BINDING;
        const Database = getBetterSqlite3();
        if (nativeBinding) {
            console.error(`[db] Using native binding: ${nativeBinding}`);
            this.db = new Database(this.dbPath, { nativeBinding });
        }
        else {
            this.db = new Database(this.dbPath);
        }
        this.configureDatabase();
        (0, migrations_js_1.runMigrations)(this.db);
        console.error(`[db] Initialized at ${this.dbPath}`);
    }
    /** Get the underlying database instance. */
    getDb() {
        if (!this.db)
            throw new Error('Database not initialized');
        return this.db;
    }
    /** Close database connection gracefully. */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.error('[db] Connection closed');
        }
    }
    ensureDirectory() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    configureDatabase() {
        if (!this.db)
            return;
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = -64000');
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('temp_store = MEMORY');
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=database-manager.js.map