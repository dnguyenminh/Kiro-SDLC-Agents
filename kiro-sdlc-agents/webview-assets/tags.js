/**
 * tags.js — Tag cloud and taxonomy tree with CRUD operations.
 * Pure DOM manipulation, no external library dependencies.
 */

/* global vscode, handlePanelMessage */

let currentView = "cloud";

function handlePanelMessage(msg) {
  if (msg.type === "tagsData") {
    renderTags(msg.taxonomy, msg.popular);
  }
  if (msg.type === "filteredEntries") {
    renderEntries(msg.entries);
  }
}

function renderTags(taxonomy, popular) {
  const loading = document.getElementById("loading");
  const content = document.getElementById("content");
  loading.style.display = "none";
  content.style.display = "block";

  renderCloud(popular);
  renderTree(taxonomy);
  setupSearch();
}

function setupSearch() {
  var input = document.getElementById("tag-search");
  if (!input) return;
  var debounce = null;
  input.addEventListener("input", function() {
    clearTimeout(debounce);
    var val = input.value.trim();
    debounce = setTimeout(function() {
      if (val.length >= 2) {
        vscode.postMessage({ type: "filterByTag", tag: val });
      } else {
        var el = document.getElementById("entries-list");
        if (el) el.innerHTML = "";
      }
    }, 300);
  });
}

function renderCloud(popular) {
  const container = document.getElementById("tag-cloud");
  if (!container || !popular || !popular.length) {
    if (container) container.innerHTML = '<p style="color:var(--text-muted);">No tags yet.</p>';
    return;
  }

  const maxCount = Math.max(...popular.map((t) => t.usage_count || t.count || 1), 1);
  container.innerHTML = popular.map((tag) => {
    const count = tag.usage_count || tag.count || 0;
    const size = 12 + Math.round((count / maxCount) * 20);
    const opacity = 0.5 + (count / maxCount) * 0.5;
    return '<span class="tag-item" data-tag="' + escapeAttr(tag.tag) + '" style="font-size:' + size + "px;opacity:" + opacity +
      ';cursor:pointer;display:inline-block;margin:4px 6px;padding:2px 8px;' +
      'border-radius:12px;background:var(--badge-bg);color:var(--badge-fg);">' +
      escapeHtml(tag.tag) + " <small>(" + count + ")</small></span>";
  }).join("");

  // Event delegation for tag clicks
  container.addEventListener("click", function(e) {
    var item = e.target.closest(".tag-item");
    if (item) {
      var tag = item.getAttribute("data-tag");
      if (tag) {
        var searchInput = document.getElementById("tag-search");
        if (searchInput) searchInput.value = tag;
        vscode.postMessage({ type: "filterByTag", tag: tag });
      }
    }
  });
}

function renderTree(taxonomy) {
  const container = document.getElementById("tag-tree");
  if (!container || !taxonomy) { return; }

  // Handle both object {cat: [tags]} and array [{tag, category}] formats
  let categories;
  if (Array.isArray(taxonomy)) {
    // Group array by category
    categories = {};
    taxonomy.forEach(function(t) {
      var cat = t.category || "uncategorized";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(t.tag);
    });
  } else {
    categories = taxonomy;
  }

  const catKeys = Object.keys(categories);
  if (catKeys.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">No taxonomy defined.</p>';
    return;
  }

  container.innerHTML = catKeys.map((cat) => {
    const tags = categories[cat] || [];
    return '<div class="card" style="margin-bottom:8px;">' +
      "<h4>" + escapeHtml(cat) + "</h4>" +
      '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
      tags.map((t) =>
        '<span class="badge tag-tree-item" data-tag="' + escapeAttr(t) + '" style="cursor:pointer;">' + escapeHtml(t) + "</span>"
      ).join("") +
      "</div></div>";
  }).join("");

  // Event delegation for tree tag clicks
  container.addEventListener("click", function(e) {
    var item = e.target.closest(".tag-tree-item");
    if (item) {
      var tag = item.getAttribute("data-tag");
      if (tag) {
        var searchInput = document.getElementById("tag-search");
        if (searchInput) searchInput.value = tag;
        vscode.postMessage({ type: "filterByTag", tag: tag });
      }
    }
  });
}

function renderEntries(entries) {
  const container = document.getElementById("entries-list");
  if (!container) { return; }

  if (!entries || entries.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">No entries found for this tag.</p>';
    container.scrollIntoView({ behavior: "smooth" });
    return;
  }

  container.innerHTML = "<h3>Entries (" + entries.length + ")</h3><ul>" +
    entries.slice(0, 20).map((e) =>
      "<li style=\"padding:4px 0;border-bottom:1px solid var(--border-subtle);\">" +
      "<span class=\"badge\">" + escapeHtml(e.type) + "</span> " +
      escapeHtml(e.title || e.summary || "Entry #" + e.id) + "</li>"
    ).join("") + "</ul>";
  container.scrollIntoView({ behavior: "smooth" });
}

function filterByTag(tag) {
  vscode.postMessage({ type: "filterByTag", tag: tag });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
