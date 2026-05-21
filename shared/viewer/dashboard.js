/** Dashboard page logic — health gauge, metrics, recommendations, trends. */

async function load() {
  try {
    const r = await fetch('/api/kb/dashboard');
    const d = await r.json();
    renderGauge(d.health_score || 0);
    renderMetrics(d);
    renderRecs(d.recommendations || []);
    renderTrends(d.trends || {});
  } catch (e) { console.error(e); }
}

function renderGauge(score) {
  const el = document.getElementById('gauge');
  const pct = score / 100;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  el.innerHTML = `<circle cx="60" cy="60" r="50" fill="none" stroke="#334155" stroke-width="10"/>
    <circle cx="60" cy="60" r="50" fill="none" stroke="${color}" stroke-width="10"
      stroke-dasharray="${pct * 314} 314" stroke-linecap="round"
      transform="rotate(-135 60 60)"/>
    <text x="60" y="65" text-anchor="middle" fill="#e2e8f0"
      font-size="20" font-weight="700">${score}</text>`;
  document.getElementById('health-label').textContent =
    score >= 70 ? 'Healthy' : score >= 40 ? 'Needs Attention' : 'Critical';
}

function renderMetrics(d) {
  const m = document.getElementById('metrics');
  const items = [
    { label: 'Total Entries', val: d.total_entries || 0, sub: 'All KB entries' },
    { label: 'Quality Avg', val: (d.quality_avg || 0).toFixed(1), sub: 'Score 0-100' },
    { label: 'Stale', val: d.stale_count || 0, sub: 'Needs review' },
    { label: 'Unowned', val: d.unowned_count || 0, sub: 'No owner assigned' }
  ];
  m.innerHTML = items.map(i => `<div class="card"><h3>${i.label}</h3>
    <div class="val">${i.val}</div><div class="sub">${i.sub}</div></div>`).join('');
}

function renderRecs(recs) {
  const el = document.getElementById('recs');
  el.innerHTML = recs.map(r => {
    const msg = r.message || r.action || String(r);
    return `<li class="${r.priority || 'low'}">${msg}</li>`;
  }).join('');
  if (!recs.length) el.innerHTML = '<li class="low">No recommendations</li>';
}

function renderTrends(trends) {
  drawMini('chart-search', trends.search_volume || [], 'Search Volume', '#38bdf8');
  drawMini('chart-ingest', trends.ingest_volume || [], 'Ingest Volume', '#a78bfa');
}

function drawMini(id, data, label, color) {
  const c = document.getElementById(id);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 300, 140);
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px system-ui'; ctx.fillText(label, 8, 16);
  if (!data.length) return;
  const max = Math.max(...data.map(d => d.count || d), 1);
  const w = 280 / data.length;
  data.forEach((d, i) => {
    const v = d.count || d;
    const h = (v / max) * 100;
    ctx.fillStyle = color; ctx.globalAlpha = 0.8;
    ctx.fillRect(10 + i * w, 130 - h, w - 2, h);
  });
  ctx.globalAlpha = 1;
}

async function loadReminders() {
  try {
    const r = await fetch('/api/kb/reminders');
    const data = await r.json();
    const items = Array.isArray(data) ? data : (data.reminders || data.entries || []);
    const el = document.getElementById('reminders');
    if (!items.length) {
      el.innerHTML = '<tr><td colspan="4" style="padding:.4rem;font-size:.75rem;opacity:.6">No due reviews</td></tr>';
      return;
    }
    el.innerHTML = items.slice(0, 10).map(e => {
      const last = e.last_reviewed_at || e.last_reviewed || 'Never';
      const days = e.days_overdue || e.overdue_days || '—';
      return `<tr><td style="padding:.4rem;border-bottom:1px solid #1e293b">${e.id || e.entry_id || ''}</td>`
        + `<td style="padding:.4rem;border-bottom:1px solid #1e293b">${esc(e.summary || '')}</td>`
        + `<td style="padding:.4rem;border-bottom:1px solid #1e293b">${last}</td>`
        + `<td style="padding:.4rem;border-bottom:1px solid #1e293b;color:#f59e0b">${days}d</td></tr>`;
    }).join('');
  } catch (e) { console.error(e); }
}

function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

load();
loadReminders();
