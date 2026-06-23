/**
 * Backfill script — processes existing entries to populate structured_map
 * and entity_index. Non-destructive and idempotent.
 */

import Database from 'better-sqlite3';
import { extractStructuredMap } from '../structured-map-extractor.js';
import { classifyEntity } from '../entity-classifier.js';

interface EntryRow {
  id: number;
  content: string;
  structured_map: string;
}

/** Backfill all entries missing structured maps. Returns count processed. */
export function backfillStructuredMaps(db: Database.Database): number {
  const entries = db.prepare(`
    SELECT id, content, structured_map FROM knowledge_entries
    WHERE structured_map = '{}' OR structured_map IS NULL
    ORDER BY id ASC
  `).all() as EntryRow[];

  if (entries.length === 0) return 0;

  const updateMap = db.prepare(
    "UPDATE knowledge_entries SET structured_map = ? WHERE id = ?"
  );
  const insertEntity = db.prepare(
    'INSERT INTO entity_index (entry_id, entity_name, entity_type) VALUES (?, ?, ?)'
  );
  const checkEntity = db.prepare(
    'SELECT 1 FROM entity_index WHERE entry_id = ? AND entity_name = ? LIMIT 1'
  );

  let processed = 0;

  const tx = db.transaction(() => {
    for (const entry of entries) {
      const map = extractStructuredMap(entry.content);
      updateMap.run(JSON.stringify(map), entry.id);

      for (const entityName of map.entities_mentioned) {
        const exists = checkEntity.get(entry.id, entityName);
        if (!exists) {
          const entityType = classifyEntity(entityName);
          insertEntity.run(entry.id, entityName, entityType);
        }
      }
      processed++;
    }
  });
  tx();

  return processed;
}
