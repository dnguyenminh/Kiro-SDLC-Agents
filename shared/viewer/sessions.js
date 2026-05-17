/* Sessions Tab — Session Explorer + Replay Timeline */
let sessionsData = [];
let replayEvents = [];
let replayIdx = 0;
let replayTimer = null;
let replayPlaying = false;

async function loadSessions() {
  const agent = document.getElementById('sess-agent')?.value || '';
  const status = document.getElementById('sess-status')?.value || '';
  let url = API + '/sessions?limit=50';
  if (agent) url += '&agent=' + encodeURIComponent(agent);
  if (status) url += '&status=' + status;
  try {
    const r = await fetch(url);
    sessionsData = await r.json();
    renderSessionList();
  } catch (e) { console.error('[sessions]', e); }
}

function renderSessionList() {
  const el = document.getElementById('sess-list');
  if (!el) return;
  el.innerHTML = sessionsData.map(s => {
    const dur = s.endedAt ? timeDiff(s.startedAt, s.endedAt) : 'active';
    return '<div class="entry-item" onclick="viewSession(\'' + s.id + '\')">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<span class="entry-type" style="color:#38bdf8">' + (s.agentName || 'unknown') + '</span>' +
      '<span class="badge badge-' + (s.status === 'active' ? 'WORKING' : 'SEMANTIC') + '">' + s.status + '</span></div>' +
      '<div class="entry-summary">' + formatTime(s.startedAt) + ' — ' + dur + '</div>' +
      '<div class="entry-meta">' + s.observationCount + ' observations</div></div>';
  }).join('') || '<div style="padding:12px;opacity:.5;font-size:.7rem">No sessions found</div>';
}

async function viewSession(sessionId) {
  document.getElementById('sess-detail').style.display = 'block';
  document.getElementById('sess-detail-id').textContent = sessionId;
  try {
    const r = await fetch(API + '/sessions/' + sessionId + '/events');
    replayEvents = await r.json();
    replayIdx = 0;
    renderTimeline();
    renderEventDetail();
  } catch (e) { console.error('[session-events]', e); }
}

function renderTimeline() {
  const bar = document.getElementById('timeline-bar');
  const total = replayEvents.length || 1;
  bar.style.width = ((replayIdx + 1) / total * 100) + '%';
  document.getElementById('timeline-pos').textContent =
    (replayIdx + 1) + '/' + replayEvents.length;
}

function renderEventDetail() {
  const el = document.getElementById('timeline-events');
  if (!replayEvents.length) { el.innerHTML = '<div style="opacity:.5;font-size:.7rem">No events</div>'; return; }
  el.innerHTML = replayEvents.map((ev, i) => {
    const active = i === replayIdx ? 'border-left:3px solid #38bdf8;' : '';
    return '<div class="entry-item" style="' + active + '" onclick="replayJump(' + i + ')">' +
      '<div style="display:flex;justify-content:space-between">' +
      '<span class="entry-type" style="color:' + opColor(ev.operation) + '">' + ev.operation + '</span>' +
      '<span class="entry-meta">' + formatTime(ev.createdAt) + '</span></div>' +
      (ev.details ? '<div class="entry-summary">' + esc(ev.details).substring(0, 80) + '</div>' : '') +
      (ev.entryId ? '<div class="entry-meta">Entry #' + ev.entryId + '</div>' : '') + '</div>';
  }).join('');
  const activeEl = el.querySelector('[style*="border-left:3px"]');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

function replayPlay() {
  if (replayPlaying) { replayPause(); return; }
  replayPlaying = true;
  document.getElementById('replay-play-btn').textContent = '⏸';
  replayTimer = setInterval(() => {
    if (replayIdx < replayEvents.length - 1) { replayIdx++; renderTimeline(); renderEventDetail(); }
    else replayPause();
  }, 1000);
}

function replayPause() {
  replayPlaying = false;
  document.getElementById('replay-play-btn').textContent = '▶';
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
}

function replayStep(dir) {
  replayPause();
  replayIdx = Math.max(0, Math.min(replayEvents.length - 1, replayIdx + dir));
  renderTimeline();
  renderEventDetail();
}

function replayJump(idx) {
  replayPause();
  replayIdx = idx;
  renderTimeline();
  renderEventDetail();
}

function replayScrub(ev) {
  const bar = document.getElementById('timeline-track');
  const rect = bar.getBoundingClientRect();
  const pct = (ev.clientX - rect.left) / rect.width;
  replayIdx = Math.floor(pct * (replayEvents.length - 1));
  replayIdx = Math.max(0, Math.min(replayEvents.length - 1, replayIdx));
  renderTimeline();
  renderEventDetail();
}

function closeReplay() {
  replayPause();
  document.getElementById('sess-detail').style.display = 'none';
}

function opColor(op) {
  const map = { INGEST: '#34d399', SEARCH: '#38bdf8', DELETE: '#f87171',
    SESSION_START: '#facc15', SESSION_END: '#94a3b8', CONSOLIDATE: '#a78bfa' };
  return map[op] || '#e2e8f0';
}
