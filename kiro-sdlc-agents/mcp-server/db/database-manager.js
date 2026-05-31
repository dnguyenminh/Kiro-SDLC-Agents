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
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const migrations_js_1 = require("./migrations.js");
const native_addon_resolver_js_1 = require("./native-addon-resolver.js");
class DatabaseManager {
    db = null;
    dbPath;
    static resolvedBinding = null; // null = not yet resolved
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    /**
     * Pre-resolve native binding (async). Call once at server startup before initialize().
     * Downloads prebuilt binary if needed (standalone mode).
     */
    static async preResolveBinding() {
        DatabaseManager.resolvedBinding = await (0, native_addon_resolver_js_1.resolveNativeBinding)();
    }
    /** Open database, enable WAL, run migrations. */
    initialize() {
        this.ensureDirectory();
        // Use pre-resolved binding, or try sync resolve as fallback
        const nativeBinding = DatabaseManager.resolvedBinding !== null
            ? DatabaseManager.resolvedBinding
            : (0, native_addon_resolver_js_1.resolveNativeBindingSync)();
        if (nativeBinding) {
            console.error(`[db] Using native binding: ${nativeBinding}`);
            this.db = new better_sqlite3_1.default(this.dbPath, { nativeBinding });
        }
        else {
            console.error('[db] Using npm-installed better-sqlite3');
            this.db = new better_sqlite3_1.default(this.dbPath);
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