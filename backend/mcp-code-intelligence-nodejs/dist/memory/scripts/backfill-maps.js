"use strict";
/**
 * Backfill script — extract structured_map for all existing entries.
 * Run: npx tsx src/memory/scripts/backfill-maps.ts [db-path]
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const structured_map_extractor_js_1 = require("../structured-map-extractor.js");
const entity_classifier_js_1 = require("../entity-classifier.js");
const migrations_v3_js_1 = require("../migrations-v3.js");
const dbPath = process.argv[2] || '.code-intel/index.db';
function main() {
    console.log(`[backfill] Opening DB: ${dbPath}`);
    const db = new better_sqlite3_1.default(dbPath);
    (0, migrations_v3_js_1.runV3Migrations)(db);
    const entries = db.prepare("SELECT id, content FROM knowledge_entries WHERE structured_map = '{}' OR structured_map IS NULL").all();
    console.log(`[backfill] Found ${entries.length} entries to process`);
    const updateStmt = db.prepare("UPDATE knowledge_entries SET structured_map = ? WHERE id = ?");
    const deleteEntities = db.prepare('DELETE FROM entity_index WHERE entry_id = ?');
    const insertEntity = db.prepare('INSERT INTO entity_index (entry_id, entity_name, entity_type) VALUES (?, ?, ?)');
    let processed = 0;
    let entitiesIndexed = 0;
    const transaction = db.transaction(() => {
        for (const entry of entries) {
            const map = (0, structured_map_extractor_js_1.extractStructuredMap)(entry.content);
            updateStmt.run(JSON.stringify(map), entry.id);
            deleteEntities.run(entry.id);
            for (const name of map.entities_mentioned) {
                insertEntity.run(entry.id, name, (0, entity_classifier_js_1.classifyEntity)(name));
                entitiesIndexed++;
            }
            processed++;
            if (processed % 100 === 0) {
                console.log(`[backfill] Processed ${processed}/${entries.length}`);
            }
        }
    });
    transaction();
    console.log(`[backfill] Done. Processed: ${processed}, Entities indexed: ${entitiesIndexed}`);
    db.close();
}
main();
//# sourceMappingURL=backfill-maps.js.map