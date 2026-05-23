/** Quality page logic — stats, score distribution, low-quality table, citations. */
var basePath = window.__MCP_BASE || '';

async function loadQuality() {
  try {
    const r = await fetch(basePath + '/api/kb/quality');
    const d = await r.json();
    renderStats(d);
    renderDist(d.distribution || d.score_distribution || {});
  } catch (e) { console.error(e); }
}

async function loadLow() {
  try {
    const r = await fetch(basePath + '/api/kb/quality/low?threshold=40&limit=20');
    const entries = await r.json();
    const el = document.getElementById('low-table');
    const items = Array.isArray(entries) ? entries : (entries.entries || []);
    el.innerHTML = items.map(e => {
      const score = e.quality_score || e.score || 0;
      const color = score >= 60 ? '#22c55e' : score >= 30 ? '#f59e0b' : '#ef4444';
      return `<tr><td>${e.id || ''}</td><td>${e.type || ''}</td>`
        + `<td>${esc(e.summary || '').substring(0, 60)}</td>`
        + `<td>${score}</td>`
        + `<td><div class="score-bar"><div class="score-fill" `
        + `style="width:${score}%;background:${color}"></div></div></td></tr>`;
    }).join('');
  } catch (e) { console.error(e); }
}

function renderStats(d) {
  const el = document.getElementById('stats');
  const items = [
    { label: 'Average Score', val: (d.average_score || d.avg_score || 0).toFixed(1) },
    { label: 'Scored Entries', val: d.scored_count || d.total_scored || 0 },
    { label: 'High Quality', val: d.high_count || 0 },
    { label: 'Low Quality', val: d.low_count || 0 }
  ];
  el.innerHTML = items.map(i => `<div class="card"><h3>${i.label}</h3>`
    + `<div class="val">${i.val}</div></div>`).join('');
}

function renderDist(dist) {
  const c = document.getElementById('dist');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const buckets = Object.entries(dist).sort((a, b) => a[0] - b[0]);
  if (!buckets.length) return;
  const max = Math.max(...buckets.map(b => b[1]), 1);
  const w = c.width / buckets.length;
  buckets.forEach(([label, count], i) => {
    const h = (count / max) * (c.height - 30);
    const score = parseInt(label) || 0;
    const color = score >= 60 ? '#22c55e' : score >= 30 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = color; ctx.globalAlpha = 0.8;
    ctx.fillRect(i * w + 2, c.height - h - 20, w - 4, h);
    ctx.globalAlpha = 1; ctx.fillStyle = '#94a3b8'; ctx.font = '9px system-ui';
    ctx.fillText(label, i * w + 2, c.height - 6);
  });
}

async function loadCited() {
  try {
    const r = await fetch(basePath + '/api/kb/citations/most?limit=10');
    const items = await r.json();
    const el = document.getElementById('cited-table');
    const list = Array.isArray(items) ? items : (items.entries || []);
    if (!list.length) {
      el.innerHTML = '<tr><td colspan="3" style="opacity:.6">No citation data</td></tr>';
      return;
    }
    el.innerHTML = list.map(e => `<tr><td>${e.id || e.entry_id || ''}</td>`
      + `<td>${esc(e.summary || '')}</td>`
      + `<td style="color:#38bdf8;font-weight:700">${e.citation_count || 0}</td></tr>`
    ).join('');
  } catch (e) { console.error(e); }
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

loadQuality();
loadLow();
loadCited();
