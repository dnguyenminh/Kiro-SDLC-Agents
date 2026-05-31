"use strict";
/**
 * Migration runner — sequential, versioned schema migrations.
 * Each migration is applied once and tracked in schema_version table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentVersion = getCurrentVersion;
exports.runMigrations = runMigrations;
const schema_js_1 = require("./schema.js");
const migrator_js_1 = require("../database/migrator.js");
/** Pattern metadata columns added in V2. */
const MIGRATION_V2_COLUMNS = [
    'di_style',
    'error_handling',
    'naming_convention',
    'logging_framework',
    'testing_framework',
    'purpose',
];
const MIGRATIONS = [
    { version: 1, description: 'Initial schema with FTS5', sql: schema_js_1.SCHEMA_V1 },
];
/** Get current schema version from database. */
function getCurrentVersion(db) {
    try {
        const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
        return row?.v ?? 0;
    }
    catch {
        return 0;
    }
}
/** Run all pending migrations sequentially. */
function runMigrations(db) {
    const current = getCurrentVersion(db);
    const pending = MIGRATIONS.filter(m => m.version > current);
    if (pending.length === 0 && current >= 2) {
        console.error('[migrations] Schema up to date');
        return;
    }
    for (const migration of pending) {
        console.error(`[migrations] Applying v${migration.version}: ${migration.description}`);
        applyMigration(db, migration);
    }
    // Always run V2 column migration (idempotent)
    if (current < 2) {
        applyMigrationV2(db);
    }
    // Run V3 graph migrations (KSA-145/153/169) — idempotent
    if (current < 3) {
        try {
            (0, migrator_js_1.runGraphMigrations)(db);
        }
        catch (err) {
            console.error('[migrations] V3 graph migration error (graceful):', err);
        }
    }
}
function applyMigration(db, migration) {
    db.exec(migration.sql);
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
    console.error(`[migrations] v${migration.version} applied`);
}
/** Migration V2 — Add pattern metadata columns to modules table. */
function applyMigrationV2(db) {
    try {
        const existing = getExistingColumns(db, 'modules');
        let added = 0;
        for (const col of MIGRATION_V2_COLUMNS) {
            if (!existing.has(col)) {
                db.exec(`ALTER TABLE modules ADD COLUMN ${col} TEXT DEFAULT NULL`);
                added++;
            }
        }
        db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(2);
        console.error(`[migrations] V2: Added ${added} pattern columns`);
    }
    catch (err) {
        console.error(`[migrations] V2 error (graceful degradation): ${err}`);
    }
}
/** Get set of column names for a table via PRAGMA. */
function getExistingColumns(db, table) {
    const rows = db.pragma(`table_info(${table})`);
    return new Set(rows.map(r => r.name));
}
//# sourceMappingURL=migrations.js.map