/* Stream Tab — Live Observation Stream via polling */
let streamEntries = [];
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
    const url = API + '/entries?limit=10&sort=created_at' +
      (streamLastId ? '&after_id=' + streamLastId : '');
    const r = await fetch(url);
    const data = await r.json();
    if (!data.length) return;

    const newEntries = data.filter(e => e.id > streamLastId);
    if (!newEntries.length) return;

    streamLastId = Math.max(...newEntries.map(e => e.id));
    streamEntries = newEntries.reverse().concat(streamEntries).slice(0, STREAM_MAX);
    renderStream();
    flashIndicator();
  } catch (e) { console.error('[stream]', e); }
}

function renderStream() {
  const el = document.getElementById('stream-list');
  if (!el) return;
  el.innerHTML = streamEntries.map(e =>
    '<div class="stream-item">' +
    '<div class="stream-time">' + formatTime(e.createdAt || '') + '</div>' +
    '<div style="display:flex;gap:6px;align-items:center">' +
    '<span class="entry-type" style="color:' + nodeColor(e.type) + '">' + e.type + '</span>' +
    '<span class="badge badge-' + e.tier + '">' + e.tier + '</span></div>' +
    '<div class="entry-summary">' + esc(e.summary) + '</div>' +
    (e.source ? '<div class="entry-meta">' + esc(e.source) + '</div>' : '') + '</div>'
  ).join('') || '<div style="padding:12px;opacity:.5;font-size:.7rem">Waiting for new entries...</div>';

  if (!streamPaused) el.scrollTop = 0;
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
  streamEntries = [];
  renderStream();
}
