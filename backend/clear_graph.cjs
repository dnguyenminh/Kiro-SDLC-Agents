const Database = require('better-sqlite3');
const db = new Database('../.code-intel/admin.db');
try {
  db.prepare('DELETE FROM graph_nodes').run();
  db.prepare('DELETE FROM graph_edges').run();
  console.log('Cleared ghost nodes from admin.db');
} catch (err) {
  console.error(err.message);
}
db.close();
