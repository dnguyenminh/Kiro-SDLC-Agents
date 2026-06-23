"use strict";
/**
 * MemoryDatabaseManager — initializes memory schema on existing DB.
 * Shares the same better-sqlite3 instance as code intelligence.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryDatabaseManager = void 0;
const schema_js_1 = require("./schema.js");
const migrations_v3_js_1 = require("./migrations-v3.js");
const migrations_v4_js_1 = require("./migrations-v4.js");
class MemoryDatabaseManager {
    db;
    initialized = false;
    constructor(db) {
        this.db = db;
    }
    /** Initialize memory tables (idempotent). */
    initialize() {
        if (this.initialized)
            return;
        this.db.exec(schema_js_1.MEMORY_SCHEMA);
        (0, migrations_v3_js_1.runV3Migrations)(this.db);
        (0, migrations_v4_js_1.runV4Migrations)(this.db);
        this.initialized = true;
        console.error('[memory-db] Schema initialized (v4)');
    }
    /** Get underlying database instance. */
    getDb() {
        return this.db;
    }
}
exports.MemoryDatabaseManager = MemoryDatabaseManager;
//# sourceMappingURL=memory-db.js.map