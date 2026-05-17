/* Graph Tab — 3D Force-directed Knowledge Graph */
const COLORS = {
  CONTEXT: '#38bdf8', DECISION: '#f472b6', ERROR_PATTERN: '#fb923c',
  ARCHITECTURE: '#a78bfa', REQUIREMENT: '#34d399', PROCEDURE: '#facc15',
  LESSON_LEARNED: '#f87171', CODE_ENTITY: '#e2e8f0', API_DESIGN: '#2dd4bf',
};

function nodeColor(t) { return COLORS[t] || '#38bdf8'; }
function nodeSize(e) {
  if (e.type === 'CODE_ENTITY') return 3;
  if (e.tier === 'PROCEDURAL') return 6;
  if (e.tier === 'SEMANTIC') return 5;
  return 4;
}

let graph3d = null, allNodes = [], selectedId = null;

async function initGraph() {
  const el = document.getElementById('graph3d');
  if (!el) return;
  try {
    const r = await fetch(API + '/graph/data?limit=500');
    const d = await r.json();
    allNodes = d.nodes.map(n => ({
      id: n.id, name: n.summary, type: n.type, tier: n.tier, source: n.source || ''
    }));
    const links = d.edges.map(e => ({ source: e.source, target: e.target }));
    graph3d = ForceGraph3D()(el)
      .graphData({ nodes: allNodes, links })
      .nodeColor(n => nodeColor(n.type)).nodeVal(n => nodeSize(n))
      .nodeLabel(n => '[' + n.type + '] ' + n.name).nodeOpacity(0.9)
      .linkColor(() => 'rgba(100,150,200,0.35)').linkWidth(1.2)
      .linkDirectionalParticles(1).linkDirectionalParticleWidth(1.2)
      .backgroundColor('#0f172a')
      .width(el.clientWidth).height(el.clientHeight)
      .onNodeClick(n => selectGraphNode(n));
    populateClusters();
    setTimeout(drawMinimap, 3000);
    setInterval(drawMinimap, 5000);
  } catch (e) { console.error('[graph]', e); }
}

function selectGraphNode(n) {
  selectedId = n.id;
  graph3d.nodeColor(nd => nd.id === selectedId ? '#ffffff' : nodeColor(nd.type));
  graph3d.nodeVal(nd => nd.id === selectedId ? 10 : nodeSize(nd));
  graph3d.linkWidth(lk => {
    const s = lk.source.id || lk.source, t = lk.target.id || lk.target;
    return (s === selectedId || t === selectedId) ? 4 : 1.2;
  });
  graph3d.linkColor(lk => {
    const s = lk.source.id || lk.source, t = lk.target.id || lk.target;
    return (s === selectedId || t === selectedId) ? '#ffffff' : 'rgba(100,150,200,0.35)';
  });
  if (graph3d) graph3d.cameraPosition(
    { x: n.x + 100, y: n.y + 80, z: n.z + 100 },
    { x: n.x, y: n.y, z: n.z }, 800
  );
  loadNodeDetail(n.id);
}

async function loadNodeDetail(id) {
  try {
    const r = await fetch(API + '/entries/' + id);
    const e = await r.json();
    const nb = await fetch(API + '/graph/' + id + '/neighbors');
    const neighbors = await nb.json();
    const panel = document.getElementById('graph-detail');
    panel.innerHTML = renderEntryDetail(e) +
      (neighbors.length ? '<div style="font-size:.65rem;margin:.4rem 0;opacity:.7">Connected (' +
        neighbors.length + '):</div>' + neighbors.slice(0, 10).map(nb =>
          '<div class="entry-item" onclick="focusEntry(' + nb.id + ')"><span class="entry-type" style="color:' +
          nodeColor(nb.type) + '">' + nb.type + '</span><div class="entry-summary">' +
          esc(nb.summary) + '</div></div>'
        ).join('') : '');
  } catch (e) { console.error(e); }
}

function focusEntry(id) {
  if (!graph3d) return;
  const n = graph3d.graphData().nodes.find(x => x.id === id);
  if (n) selectGraphNode(n);
  else loadNodeDetail(id);
}

function drawMinimap() {
  if (!graph3d) return;
  const c = document.getElementById('mc');
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 180, 140);
  const ns = graph3d.graphData().nodes;
  if (!ns.length) return;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  ns.forEach(n => { if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x; if (n.z < z0) z0 = n.z; if (n.z > z1) z1 = n.z; });
  x0 -= 50; x1 += 50; z0 -= 50; z1 += 50;
  const sx = 180 / (x1 - x0 || 1), sz = 140 / (z1 - z0 || 1);
  ns.forEach(n => { ctx.fillStyle = nodeColor(n.type); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc((n.x - x0) * sx, (n.z - z0) * sz, 2, 0, 6.28); ctx.fill(); });
  ctx.globalAlpha = 1;
  c.onclick = function(ev) {
    const br = c.getBoundingClientRect();
    const mx = (ev.clientX - br.left) / 180 * (x1 - x0) + x0;
    const mz = (ev.clientY - br.top) / 140 * (z1 - z0) + z0;
    graph3d.cameraPosition({ x: mx, y: 80, z: mz }, { x: mx, y: 0, z: mz }, 800);
  };
}

function populateClusters() {
  const s = new Set();
  allNodes.forEach(n => { if (n.source) { const p = n.source.split('/').slice(0, 2).join('/'); if (p) s.add(p); } });
  const sel = document.getElementById('cs');
  if (!sel) return;
  Array.from(s).sort().forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
}

function graphFit() { if (graph3d) graph3d.zoomToFit(400); }
function graphReset() { if (graph3d) graph3d.cameraPosition({ x: 0, y: 0, z: 500 }, { x: 0, y: 0, z: 0 }, 800); }
function graphJumpCluster(val) {
  if (!graph3d || !val) return;
  const ns = graph3d.graphData().nodes.filter(n => n.source && n.source.startsWith(val));
  if (!ns.length) return;
  const cx = ns.reduce((s, n) => s + n.x, 0) / ns.length;
  const cy = ns.reduce((s, n) => s + n.y, 0) / ns.length;
  const cz = ns.reduce((s, n) => s + n.z, 0) / ns.length;
  graph3d.cameraPosition({ x: cx + 120, y: cy + 80, z: cz + 120 }, { x: cx, y: cy, z: cz }, 800);
}
