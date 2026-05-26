/** Tags page logic — matches extension panel with table + pagination. */
var basePath = window.__MCP_BASE || '';
var PAGE_SIZE = 20;
var currentTag = '';
var currentOffset = 0;
var currentTotal = 0;

async function loadPopular() {
  try {
    var r = await fetch(basePath + '/api/kb/tags/popular?limit=50');
    var tags = await r.json();
    var el = document.getElementById('cloud');
    if (!tags || !tags.length) { el.innerHTML = '<p style="color:#64748b;">No tags yet.</p>'; return; }
    var max = Math.max.apply(null, tags.map(function(t) { return t.usage_count || 1; }));
    el.innerHTML = tags.map(function(t) {
      var count = t.usage_count || t.count || 0;
      var size = 12 + Math.round((count / max) * 20);
      var opacity = 0.5 + (count / max) * 0.5;
      var hue = ((t.tag || '').charCodeAt(0) * 37) % 360;
      return '<span class="tag" style="font-size:' + size + 'px;opacity:' + opacity
        + ';background:hsla(' + hue + ',60%,40%,0.3);color:hsl(' + hue + ',70%,75%)"'
        + ' onclick="searchTag(\'' + esc(t.tag) + '\')">'
        + esc(t.tag) + ' <small>(' + count + ')</small></span>';
    }).join('');
  } catch (e) { console.error(e); }
}

async function loadTaxonomy() {
  try {
    var r = await fetch(basePath + '/api/kb/tags');
    var data = await r.json();
    var el = document.getElementById('tree');
    var categories = data.categories || data;
    if (Array.isArray(data)) {
      categories = {};
      data.forEach(function(t) {
        var cat = t.category || 'uncategorized';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(t.tag);
      });
    }
    var catKeys = Object.keys(categories);
    if (!catKeys.length) { el.innerHTML = '<p style="color:#64748b;">No taxonomy defined.</p>'; return; }
    el.innerHTML = catKeys.map(function(cat) {
      var tags = categories[cat] || [];
      return '<div style="margin-bottom:12px;">'
        + '<h4 style="font-size:.8rem;color:#38bdf8;margin-bottom:6px;">' + esc(cat) + '</h4>'
        + '<div style="display:flex;flex-wrap:wrap;gap:4px;">'
        + tags.map(function(t) {
            return '<span class="tag" style="font-size:11px;cursor:pointer;" onclick="searchTag(\'' + esc(t) + '\')">' + esc(t) + '</span>';
          }).join('')
        + '</div></div>';
    }).join('');
  } catch (e) { console.error(e); }
}

var _searchDebounce = null;
function setupSearch() {
  var input = document.getElementById('search-tag');
  if (!input) return;
  input.addEventListener('input', function() {
    clearTimeout(_searchDebounce);
    var val = input.value.trim();
    _searchDebounce = setTimeout(function() {
      if (val.length >= 2) { currentOffset = 0; searchTag(val); }
      else { document.getElementById('results').innerHTML = ''; }
    }, 300);
  });
  input.addEventListener('keyup', function(ev) {
    if (ev.key === 'Enter' && this.value.trim()) {
      clearTimeout(_searchDebounce);
      currentOffset = 0;
      searchTag(this.value.trim());
    }
  });
}

async function searchTag(tag) {
  currentTag = tag;
  document.getElementById('search-tag').value = tag;
  var el = document.getElementById('results');
  try {
    var r = await fetch(basePath + '/api/kb/tags/search?tags=' + encodeURIComponent(tag)
      + '&limit=' + PAGE_SIZE + '&offset=' + currentOffset);
    var data = await r.json();
    var entries = data.entries || data;
    var total = data.total || entries.length;
    currentTotal = total;
    if (!entries || !entries.length) {
      el.innerHTML = '<p style="color:#64748b;font-size:.75rem;">No entries found for this tag.</p>';
      return;
    }
    var totalPages = Math.ceil(total / PAGE_SIZE);
    var currentPage = Math.floor(currentOffset / PAGE_SIZE) + 1;
    var html = '<h3 style="font-size:.85rem;margin-bottom:8px;">Entries (' + total + ')</h3>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:.75rem;">';
    html += '<thead><tr style="border-bottom:1px solid #475569;text-align:left;">'
      + '<th style="padding:6px 8px;width:40px;">#</th>'
      + '<th style="padding:6px 8px;width:50px;">ID</th>'
      + '<th style="padding:6px 8px;width:120px;">Type</th>'
      + '<th style="padding:6px 8px;">Summary</th>'
      + '</tr></thead><tbody>';
    entries.forEach(function(e, i) {
      html += '<tr style="border-bottom:1px solid #1e293b;">'
        + '<td style="padding:5px 8px;color:#64748b;">' + (currentOffset + i + 1) + '</td>'
        + '<td style="padding:5px 8px;color:#64748b;">' + (e.id || '') + '</td>'
        + '<td style="padding:5px 8px;"><span style="font-size:.65rem;color:#a78bfa;font-weight:700;">' + esc(e.type || 'CONTEXT') + '</span></td>'
        + '<td style="padding:5px 8px;">' + esc(e.title || e.summary || 'Entry #' + e.id) + '</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    if (totalPages > 1) {
      html += '<div style="margin-top:10px;display:flex;align-items:center;gap:8px;font-size:.75rem;">';
      html += '<button onclick="goPage(-1)" ' + (currentPage <= 1 ? 'disabled' : '') + ' style="padding:4px 10px;border-radius:3px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;cursor:pointer;">&laquo; Prev</button>';
      html += '<span style="color:#94a3b8;">Page ' + currentPage + ' / ' + totalPages + '</span>';
      html += '<button onclick="goPage(1)" ' + (currentPage >= totalPages ? 'disabled' : '') + ' style="padding:4px 10px;border-radius:3px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;cursor:pointer;">Next &raquo;</button>';
      html += '</div>';
    }
    el.innerHTML = html;
    el.scrollIntoView({ behavior: 'smooth' });
  } catch (e) { console.error(e); }
}

function goPage(dir) {
  currentOffset += dir * PAGE_SIZE;
  if (currentOffset < 0) currentOffset = 0;
  if (currentOffset >= currentTotal) currentOffset = Math.max(0, currentTotal - PAGE_SIZE);
  searchTag(currentTag);
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }

loadPopular();
loadTaxonomy();
setupSearch();
