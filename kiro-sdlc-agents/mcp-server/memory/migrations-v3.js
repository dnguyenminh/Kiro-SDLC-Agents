"use strict";
/**
 * V3 migration runner — safely applies additive schema changes.
 * Each ALTER is wrapped in try/catch (column may already exist).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runV3Migrations = runV3Migrations;
const schema_v3_js_1 = require("./schema-v3.js");
/** Run all V3 migrations (idempotent — safe to call multiple times). */
function runV3Migrations(db) {
    // F1: Core Memory
    runAlterStatements(db, schema_v3_js_1.SCHEMA_V3_CORE_MEMORY);
    safeExec(db, schema_v3_js_1.SCHEMA_V3_CORE_MEMORY_INDEX);
    // F2: Conversation History
    safeExec(db, schema_v3_js_1.SCHEMA_V3_CONVERSATION);
    runAlterStatements(db, schema_v3_js_1.SCHEMA_V3_CONVERSATION_SUMMARIZED);
    safeExec(db, schema_v3_js_1.SCHEMA_V3_CONVERSATION_INDEXES);
    // F3: Structured Map
    runAlterStatements(db, schema_v3_js_1.SCHEMA_V3_STRUCTURED_MAP_ALTER);
    safeExec(db, schema_v3_js_1.SCHEMA_V3_STRUCTURED_MAP_TABLES);
    safeExec(db, schema_v3_js_1.SCHEMA_V3_ENTITY_FTS);
    // F4: Anti-Pattern Protection
    runAlterStatements(db, schema_v3_js_1.SCHEMA_V3_QUALITY_ARCHIVE_ALTER);
    safeExec(db, schema_v3_js_1.SCHEMA_V3_QUALITY_ARCHIVE_INDEXES);
    safeExec(db, schema_v3_js_1.SCHEMA_V3_AGENT_SCOPE);
}
/** Run ALTER statements one by one, ignoring "duplicate column" errors. */
function runAlterStatements(db, stmts) {
    for (const sql of stmts) {
        try {
            db.exec(sql);
        }
        catch (err) {
            const msg = err.message ?? '';
            if (!msg.includes('duplicate column'))
                throw err;
        }
    }
}
/** Execute multi-statement SQL, ignoring "already exists" errors. */
function safeExec(db, sql) {
    try {
        db.exec(sql);
    }
    catch (err) {
        const msg = err.message ?? '';
        if (!msg.includes('already exists'))
            throw err;
    }
}
//# sourceMappingURL=migrations-v3.js.map