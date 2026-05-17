/**
 * HTML template for 3D Knowledge Graph web viewer.
 * Exact port of Kotlin ViewerHtml.kt.
 */

const JS = `
const API='/api/memory';
const COLORS={CONTEXT:'#38bdf8',DECISION:'#f472b6',ERROR_PATTERN:'#fb923c',ARCHITECTURE:'#a78bfa',REQUIREMENT:'#34d399',PROCEDURE:'#facc15',LESSON_LEARNED:'#f87171',CODE_ENTITY:'#e2e8f0'};
function nodeColor(t){return COLORS[t]||'#38bdf8'}
function nodeSize(e){return e.type==='CODE_ENTITY'?3:e.tier==='PROCEDURAL'?6:e.tier==='SEMANTIC'?5:4}
let graph3d=null,allNodes=[];
async function initGraph(){
  const el=document.getElementById('graph3d');
  try{const r=await fetch(API+'/graph/data?limit=500');const d=await r.json();
  allNodes=d.nodes.map(n=>({id:n.id,name:n.summary,type:n.type,tier:n.tier,source:n.source||''}));
  const links=d.edges.map(e=>({source:e.source,target:e.target}));
  graph3d=ForceGraph3D()(el).graphData({nodes:allNodes,links}).nodeColor(n=>nodeColor(n.type)).nodeVal(n=>nodeSize(n)).nodeLabel(n=>'['+n.type+'] '+n.name).nodeOpacity(0.9).linkColor(()=>'rgba(100,150,200,0.35)').linkWidth(1.2).linkDirectionalParticles(1).linkDirectionalParticleWidth(1.2).backgroundColor('#0f172a').width(el.clientWidth).height(el.clientHeight).onNodeClick(n=>showTip(n));
  populateClusters();setTimeout(drawMinimap,3000);setInterval(drawMinimap,5000);
  }catch(e){console.error(e)}
}
let selectedId=null;
function showTip(n){
  selectedId=n.id;
  graph3d.nodeColor(nd=>nd.id===selectedId?'#ffffff':nodeColor(nd.type));
  graph3d.nodeVal(nd=>nd.id===selectedId?10:nodeSize(nd));
  graph3d.linkWidth(link=>{const s=link.source.id||link.source;const t=link.target.id||link.target;return(s===selectedId||t===selectedId)?4:1.2});
  graph3d.linkColor(link=>{const s=link.source.id||link.source;const t=link.target.id||link.target;return(s===selectedId||t===selectedId)?'#ffffff':'rgba(100,150,200,0.35)'});
  graph3d.linkDirectionalParticles(link=>{const s=link.source.id||link.source;const t=link.target.id||link.target;return(s===selectedId||t===selectedId)?4:1});
  graph3d.linkDirectionalParticleWidth(link=>{const s=link.source.id||link.source;const t=link.target.id||link.target;return(s===selectedId||t===selectedId)?3:1.2});
  const tt=document.getElementById('tooltip');
  tt.style.display='none';
  if(graph3d)graph3d.cameraPosition({x:n.x+100,y:n.y+80,z:n.z+100},{x:n.x,y:n.y,z:n.z},800);
  loadNodeDetail(n.id);
}
async function loadNodeDetail(id){
  try{const r=await fetch(API+'/entries/'+id);const e=await r.json();
  const nb=await fetch(API+'/graph/'+id+'/neighbors');const neighbors=await nb.json();
  const panel=document.getElementById('entries');
  panel.innerHTML='<div style="background:#1e293b;padding:.6rem;border-radius:.4rem;margin-bottom:.5rem;border-left:3px solid '+nodeColor(e.type)+'"><b style="color:'+nodeColor(e.type)+';font-size:.7rem">['+e.type+'] ID:'+e.id+'</b><div style="font-size:.7rem;margin:.3rem 0">'+esc2(e.summary)+'</div><div style="font-size:.6rem;opacity:.7">Tier: '+e.tier+' | Source: '+(e.source||'n/a')+'</div><div style="font-size:.6rem;opacity:.7">Confidence: '+e.confidence+' | Access: '+e.accessCount+'</div><div style="font-size:.6rem;opacity:.7;margin-top:.2rem">Tags: '+(e.tags||'none')+'</div><details style="margin-top:.4rem"><summary style="font-size:.6rem;cursor:pointer">Full Content</summary><pre style="font-size:.55rem;white-space:pre-wrap;max-height:200px;overflow-y:auto;background:#0f172a;padding:.4rem;border-radius:.3rem;margin-top:.2rem">'+esc2((e.content||'').substring(0,1000))+'</pre></details></div>'+
  (neighbors.length?'<div style="font-size:.65rem;margin-bottom:.3rem;opacity:.7">Connected ('+neighbors.length+'):</div>'+neighbors.slice(0,10).map(nb=>'<li class="ei" onclick="fe('+nb.id+')"><span class="tp" style="color:'+nodeColor(nb.type)+'">'+nb.type+'</span><div class="sm">'+esc(nb.summary)+'</div></li>').join(''):'');
  }catch(e){console.error(e)}
}
function esc2(s){return(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function drawMinimap(){
  if(!graph3d)return;const c=document.getElementById('mc');const ctx=c.getContext('2d');
  ctx.clearRect(0,0,180,140);const ns=graph3d.graphData().nodes;if(!ns.length)return;
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
  ns.forEach(n=>{if(n.x<x0)x0=n.x;if(n.x>x1)x1=n.x;if(n.z<z0)z0=n.z;if(n.z>z1)z1=n.z});
  x0-=50;x1+=50;z0-=50;z1+=50;const sx=180/(x1-x0||1),sz=140/(z1-z0||1);
  ns.forEach(n=>{ctx.fillStyle=nodeColor(n.type);ctx.globalAlpha=0.7;ctx.beginPath();ctx.arc((n.x-x0)*sx,(n.z-z0)*sz,2,0,6.28);ctx.fill()});
  ctx.globalAlpha=1;
  c.onclick=function(ev){const br=c.getBoundingClientRect();const mx=(ev.clientX-br.left)/180*(x1-x0)+x0;const mz=(ev.clientY-br.top)/140*(z1-z0)+z0;graph3d.cameraPosition({x:mx,y:80,z:mz},{x:mx,y:0,z:mz},800)};
}
function populateClusters(){const s=new Set();allNodes.forEach(n=>{if(n.source){const p=n.source.split('/').slice(0,2).join('/');if(p)s.add(p)}});const sel=document.getElementById('cs');Array.from(s).sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o)})}
document.getElementById('cs').addEventListener('change',function(){if(!graph3d||!this.value)return;const ns=graph3d.graphData().nodes.filter(n=>n.source&&n.source.startsWith(this.value));if(!ns.length)return;const cx=ns.reduce((s,n)=>s+n.x,0)/ns.length,cy=ns.reduce((s,n)=>s+n.y,0)/ns.length,cz=ns.reduce((s,n)=>s+n.z,0)/ns.length;graph3d.cameraPosition({x:cx+120,y:cy+80,z:cz+120},{x:cx,y:cy,z:cz},800)});
document.getElementById('bf').addEventListener('click',()=>{if(graph3d)graph3d.zoomToFit(400)});
document.getElementById('br').addEventListener('click',()=>{if(graph3d)graph3d.cameraPosition({x:0,y:0,z:500},{x:0,y:0,z:0},800)});
async function loadStatus(){try{const r=await fetch(API+'/status');const d=await r.json();document.getElementById('stats').innerHTML='<div class="sc"><div class="v">'+d.totalEntries+'</div><div class="l">Entries</div><div class="t">Documents + code symbols + decisions + patterns</div></div><div class="sc"><div class="v">'+d.totalEdges+'</div><div class="l">Edges</div><div class="t">SIBLING (same doc) + IMPLEMENTED_BY (code\\u2194doc)</div></div><div class="sc"><div class="v">'+d.totalVectors+'</div><div class="l">Vectors</div><div class="t">Semantic embeddings (all-MiniLM-L6-v2). 0=model loading or not yet generated. Vectors enable AI similarity search.</div></div><div class="sc"><div class="v">'+Object.keys(d.tierBreakdown||{}).length+'</div><div class="l">Tiers</div><div class="t">WORKING=active session, SEMANTIC=code entities (long-term), EPISODIC=events, PROCEDURAL=patterns</div></div>'}catch(e){}}
async function loadEntries(){try{const r=await fetch(API+'/entries?tier=WORKING&limit=15');const d=await r.json();document.getElementById('entries').innerHTML=d.map(e=>'<li class="ei" onclick="fe('+e.id+')"><span class="tp" style="color:'+nodeColor(e.type)+'">'+e.type+'</span><span class="tb tier-'+e.tier+'">'+e.tier+'</span><div class="sm">'+esc(e.summary)+'</div></li>').join('')}catch(e){}}
function fe(id){if(!graph3d)return;const n=graph3d.graphData().nodes.find(x=>x.id===id);if(n){showTip(n)}else{loadNodeDetail(id);fetch(API+'/entries/'+id).then(r=>r.json()).then(e=>{const nd={id:e.id,name:e.summary,type:e.type,tier:e.tier,source:e.source||''};const d=graph3d.graphData();d.nodes.push(nd);graph3d.graphData(d);setTimeout(()=>{const added=graph3d.graphData().nodes.find(x=>x.id===id);if(added)showTip(added)},500)}).catch(()=>{})}}
function esc(s){return(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0,100)}
document.getElementById('search').addEventListener('keyup',async function(ev){if(ev.key!=='Enter')return;const q=this.value;if(!q)return;try{const r=await fetch(API+'/search?q='+encodeURIComponent(q));const d=await r.json();document.getElementById('entries').innerHTML=d.map(e=>'<li class="ei" onclick="fe('+e.id+')"><span class="tp" style="color:'+nodeColor(e.type)+'">'+e.type+'</span><span class="tb tier-'+e.tier+'">'+e.tier+'</span><div class="sm">'+esc(e.summary)+'</div></li>').join('')}catch(e){}});
loadStatus();loadEntries();initGraph();
`;

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;background:#0f172a;color:#e2e8f0;overflow:hidden}#container{position:relative;width:100vw;height:100vh}#graph3d{position:absolute;top:0;left:0;right:320px;bottom:0}#ov{position:absolute;top:0;left:0;right:320px;padding:.7rem 1.2rem;display:flex;align-items:center;gap:.6rem;z-index:10;background:linear-gradient(180deg,rgba(15,23,42,.95),transparent)}#ov h1{font-size:.95rem;font-weight:600;white-space:nowrap}#search{flex:1;max-width:300px;padding:.35rem .7rem;border-radius:.35rem;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font-size:.75rem}.ob{padding:.3rem .6rem;border-radius:.3rem;border:1px solid #475569;background:#1e293b;color:#e2e8f0;cursor:pointer;font-size:.7rem}.ob:hover{background:#334155}#cs{padding:.3rem .5rem;border-radius:.3rem;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font-size:.7rem;max-width:160px}#sb{position:absolute;top:0;right:0;width:320px;height:100vh;background:rgba(30,41,59,.95);border-left:1px solid #334155;overflow-y:auto;padding:.8rem;z-index:10}.stats{display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.8rem}.sc{background:#334155;border-radius:.4rem;padding:.5rem;text-align:center;position:relative;cursor:help}.sc .v{font-size:1.2rem;font-weight:700;color:#38bdf8}.sc .l{font-size:.6rem;color:#94a3b8}.sc .t{display:none;position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);background:#0f172a;border:1px solid #475569;border-radius:.3rem;padding:.4rem .5rem;font-size:.6rem;width:180px;z-index:30;text-align:left;line-height:1.3}.sc:hover .t{display:block}.ei{padding:.4rem;margin-bottom:.3rem;background:#334155;border-radius:.3rem;cursor:pointer}.ei:hover{background:#475569}.tp{font-size:.5rem;text-transform:uppercase;font-weight:700}.sm{font-size:.65rem;margin-top:.1rem;opacity:.8}.tb{display:inline-block;padding:.05rem .3rem;border-radius:1rem;font-size:.5rem;font-weight:600;margin-left:.2rem}.tier-WORKING{background:#854d0e;color:#fef08a}.tier-SEMANTIC{background:#166534;color:#86efac}#tooltip{position:absolute;padding:.5rem .7rem;background:rgba(15,23,42,.97);border:1px solid #38bdf8;border-radius:.4rem;font-size:.7rem;max-width:300px;display:none;z-index:25;box-shadow:0 4px 12px rgba(0,0,0,.5)}.cb{position:absolute;top:3px;right:6px;cursor:pointer;opacity:.6;font-size:.75rem}.cb:hover{opacity:1}#lg{position:absolute;bottom:.8rem;left:.8rem;background:rgba(30,41,59,.9);padding:.5rem;border-radius:.4rem;font-size:.6rem;z-index:10}#lg div{display:flex;align-items:center;gap:.3rem;margin-bottom:.15rem}#lg span{display:inline-block;width:9px;height:9px;border-radius:50%}#mm{position:absolute;bottom:.8rem;right:332px;width:180px;height:140px;background:rgba(15,23,42,.9);border:1px solid #475569;border-radius:.4rem;z-index:10;cursor:crosshair}#mm canvas{width:100%;height:100%}#mml{position:absolute;top:3px;left:5px;font-size:.5rem;opacity:.5}`;

const BODY = `<div id="container"><div id="graph3d"></div>
<div id="ov"><h1>\u{1F9E0} 3D Graph</h1><input type="text" id="search" placeholder="Search..."><button class="ob" id="bf" title="Fit all">\u229E Fit</button><button class="ob" id="br" title="Reset view">\u21BA</button><select id="cs"><option value="">Jump to...</option></select></div>
<div id="sb"><div class="stats" id="stats"></div><h3 style="font-size:.75rem;margin-bottom:.3rem">Recent Entries</h3><ul id="entries" style="list-style:none"></ul></div>
<div id="tooltip"></div>
<div id="mm"><span id="mml">minimap (click to navigate)</span><canvas id="mc" width="180" height="140"></canvas></div>
<div id="lg"><div><span style="background:#34d399"></span>REQUIREMENT</div><div><span style="background:#a78bfa"></span>ARCHITECTURE</div><div><span style="background:#e2e8f0"></span>CODE_ENTITY</div><div><span style="background:#f472b6"></span>DECISION</div><div><span style="background:#fb923c"></span>ERROR_PATTERN</div><div><span style="background:#facc15"></span>PROCEDURE</div><div><span style="background:#38bdf8"></span>CONTEXT</div></div>
</div>`;

export const VIEWER_HTML =
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SDLC Memory \u2014 3D Knowledge Graph</title>\n<style>${CSS}</style></head>\n<body>${BODY}<script src="https://cdn.jsdelivr.net/npm/3d-force-graph@1/dist/3d-force-graph.min.js"></script>\n<script>\n${JS}\n</script></body></html>`;
