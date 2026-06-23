const Database = require('better-sqlite3');
const db = new Database('../.code-intel/admin.db', { readonly: true });
try {
  const row = db.prepare('SELECT COUNT(*) as count FROM graph_nodes').get();
  console.log('graph_nodes count in admin.db:', row.count);
} catch (err) {
  console.error(err.message);
}
db.close();
