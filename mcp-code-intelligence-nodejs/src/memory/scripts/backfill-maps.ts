/**
 * Backfill script — extract structured_map for all existing entries.
 * Run: npx tsx src/memory/scripts/backfill-maps.ts [db-path]
 */

import Database from 'better-sqlite3';
import { extractStructuredMap } from '../structured-map-extractor.js';
import { classifyEntity } from '../entity-classifier.js';
import { runV3Migrations } from '../migrations-v3.js';

const dbPath = process.argv[2] || '.code-intel/index.db';

function main(): void {
  console.log(`[backfill] Opening DB: ${dbPath}`);
  const db = new Database(dbPath);
  runV3Migrations(db);

  const entries = db.prepare(
    "SELECT id, content FROM knowledge_entries WHERE structured_map = '{}' OR structured_map IS NULL"
  ).all() as Array<{ id: number; content: string }>;

  console.log(`[backfill] Found ${entries.length} entries to process`);

  const updateStmt = db.prepare(
    "UPDATE knowledge_entries SET structured_map = ? WHERE id = ?"
  );
  const deleteEntities = db.prepare('DELETE FROM entity_index WHERE entry_id = ?');
  const insertEntity = db.prepare(
    'INSERT INTO entity_index (entry_id, entity_name, entity_type) VALUES (?, ?, ?)'
  );

  let processed = 0;
  let entitiesIndexed = 0;

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      const map = extractStructuredMap(entry.content);
      updateStmt.run(JSON.stringify(map), entry.id);
      deleteEntities.run(entry.id);
      for (const name of map.entities_mentioned) {
        insertEntity.run(entry.id, name, classifyEntity(name));
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
