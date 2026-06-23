import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('.code-intel/index.db');
const db = new Database(dbPath);

console.log('Querying index-backend.db at:', dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

for (const table of tables) {
  try {
    const count = db.prepare(`SELECT count(*) as count FROM ${table.name}`).get();
    console.log(`Table ${table.name}: ${count.count} rows`);
  } catch (err) {
    console.error(`Error querying ${table.name}:`, err.message);
  }
}
