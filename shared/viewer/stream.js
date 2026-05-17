/* Stream Tab — Live Operations Stream via audit log polling */
let streamEvents = [];
let streamLastId = 0;
let streamPaused = false;
let streamTimer = null;
const STREAM_MAX = 100;
const STREAM_INTERVAL = 3000;

function startStream() {
  if (streamTimer) return;
  streamTimer = setInterval(pollStream, STREAM_INTERVAL);
  pollStream();
}

function stopStream() {
  if (streamTimer) { clearInterval(streamTimer); streamTimer = null; }
}

async function pollStream() {
  if (streamPaused) return;
  try {
    const url = API + '/audit?limit=20' + (streamLastId ? '&after_id=' + streamLastId : '') + '&exclude=SESSION_START,SESSION_END';
    const r = await fetch(url);
    const data = await r.json();
    if (!data.length) return;

    const newEvents = data.filter(e => e.id > streamLastId);
    if (!newEvents.length) return;

    streamLastId = Math.max(...newEvents.map(e => e.id));
    streamEvents = newEvents.reverse().concat(streamEvents).slice(0, STREAM_MAX);
    renderStream();
    flashIndicator();
  } catch (e) { console.error('[stream]', e); }
}

function renderStream() {
  const el = document.getElementById('stream-list');
  if (!el) return;
  el.innerHTML = streamEvents.map(e =>
    '<div class="stream-item">' +
    '<div class="stream-time">' + formatTime(e.createdAt || '') + '</div>' +
    '<div style="display:flex;gap:6px;align-items:center">' +
    '<span class="entry-type" style="color:' + opColor(e.operation) + '">' + e.operation + '</span>' +
    (e.sessionId ? '<span class="entry-meta">session:' + e.sessionId.substring(0, 8) + '</span>' : '') +
    '</div>' +
    (e.details ? '<div class="entry-summary">' + esc(e.details) + '</div>' : '') +
    (e.entryId ? '<div class="entry-meta">Entry #' + e.entryId + '</div>' : '') +
    '</div>'
  ).join('') || '<div style="padding:12px;opacity:.5;font-size:.7rem">Waiting for operations...</div>';

  if (!streamPaused) el.scrollTop = 0;
}

function opColor(op) {
  const map = { INGEST: '#34d399', INGEST_FILE: '#34d399', SEARCH: '#38bdf8',
    DELETE: '#f87171', ACCESS: '#facc15', SESSION_START: '#a78bfa',
    SESSION_END: '#94a3b8', CONSOLIDATE: '#fb923c', SYNC_CODE: '#f472b6' };
  return map[op] || '#e2e8f0';
}

function toggleStreamPause() {
  streamPaused = !streamPaused;
  const btn = document.getElementById('stream-pause-btn');
  if (btn) btn.textContent = streamPaused ? '▶ Resume' : '⏸ Pause';
}

function flashIndicator() {
  const dot = document.getElementById('stream-indicator');
  if (!dot) return;
  dot.classList.add('flash');
  setTimeout(() => dot.classList.remove('flash'), 600);
}

function clearStream() {
  streamEvents = [];
  streamLastId = 0;
  renderStream();
}
