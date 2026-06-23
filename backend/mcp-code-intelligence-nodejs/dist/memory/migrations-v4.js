"use strict";
/**
 * V4 migration runner — adds agent_name column to knowledge_entries.
 * Idempotent — safe to call multiple times.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runV4Migrations = runV4Migrations;
const schema_v4_js_1 = require("./schema-v4.js");
/** Run all V4 migrations (idempotent). */
function runV4Migrations(db) {
    runAlterStatements(db, schema_v4_js_1.SCHEMA_V4_AGENT_NAME_ALTER);
    safeExec(db, schema_v4_js_1.SCHEMA_V4_AGENT_NAME_INDEX);
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
//# sourceMappingURL=migrations-v4.js.map