/**
 * GraphPanel — 3D force-directed knowledge graph using Three.js + 3d-force-graph.
 */

import * as vscode from "vscode";
import { WebviewToExtMessage, GraphNode, GraphEdge, NODE_TYPE_COLORS, SERVER_CONSTANTS } from "../types";
import { McpServerManager } from "../mcp-server-manager";
import { BasePanel } from "./base-panel";

export class GraphPanel extends BasePanel {
  constructor(mcpManager: McpServerManager, extensionUri: vscode.Uri) {
    super("graph", mcpManager, extensionUri);
  }

  getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const body = `
    <!-- Toolbar -->
    <div id="toolbar" style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--vscode-editorWidget-background, var(--vscode-sideBar-background));border-bottom:1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));z-index:200;position:relative;">
      <!-- Search Box -->
      <div style="position:relative;flex:1;max-width:240px;">
        <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);opacity:0.6;">&#128269;</span>
        <input id="search-input" type="text" placeholder="Search entries by title or type..."
          style="width:100%;padding:4px 8px 4px 28px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:3px;font-size:12px;outline:none;"
           />
      </div>

      <!-- Type Filter -->
      <div class="filter-dropdown" style="position:relative;">
        <button id="type-filter-btn" 
          style="padding:4px 10px;background:var(--vscode-button-secondaryBackground, var(--vscode-input-background));color:var(--vscode-button-secondaryForeground, var(--vscode-foreground));border:1px solid var(--vscode-input-border);border-radius:3px;font-size:12px;cursor:pointer;white-space:nowrap;">
          Type &#9660;
        </button>
        <div id="type-dropdown" class="dropdown-panel" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-editorWidget-border);border-radius:4px;padding:6px;z-index:300;min-width:180px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="DECISION" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#3b82f6;display:inline-block;"></span>Decision</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="ERROR_PATTERN" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block;"></span>Error Pattern</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="ARCHITECTURE" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#8b5cf6;display:inline-block;"></span>Architecture</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="PROCEDURE" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;"></span>Procedure</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="CONTEXT" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>Context</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="LESSON_LEARNED" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#06b6d4;display:inline-block;"></span>Lesson Learned</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="CODE_ENTITY" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#6366f1;display:inline-block;"></span>Code Entity</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="REQUIREMENT" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#ec4899;display:inline-block;"></span>Requirement</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="API_DESIGN" checked  /><span style="width:10px;height:10px;border-radius:50%;background:#14b8a6;display:inline-block;"></span>API Design</label>
        </div>
      </div>

      <!-- Tier Filter -->
      <div class="filter-dropdown" style="position:relative;">
        <button id="tier-filter-btn" 
          style="padding:4px 10px;background:var(--vscode-button-secondaryBackground, var(--vscode-input-background));color:var(--vscode-button-secondaryForeground, var(--vscode-foreground));border:1px solid var(--vscode-input-border);border-radius:3px;font-size:12px;cursor:pointer;white-space:nowrap;">
          Tier &#9660;
        </button>
        <div id="tier-dropdown" class="dropdown-panel" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-editorWidget-border);border-radius:4px;padding:6px;z-index:300;min-width:150px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="WORKING" checked  />Working</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="EPISODIC" checked  />Episodic</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="SEMANTIC" checked  />Semantic</label>
          <label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;"><input type="checkbox" value="PROCEDURAL" checked  />Procedural</label>
        </div>
      </div>

      <!-- Spacer -->

      <!-- Jump To Combobox -->
      <select id="jump-to" style="padding:4px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:3px;font-size:12px;min-width:120px;">
        <option value="">Jump to...</option>
        <option value="DECISION">Decisions</option>
        <option value="ARCHITECTURE">Architecture</option>
        <option value="ERROR_PATTERN">Error Patterns</option>
        <option value="REQUIREMENT">Requirements</option>
        <option value="PROCEDURE">Procedures</option>
        <option value="LESSON_LEARNED">Lessons Learned</option>
        <option value="CODE_ENTITY">Code Entities</option>
        <option value="API_DESIGN">API Design</option>
        <option value="CONTEXT">Context</option>
      </select>

      <!-- Refresh Button -->
      <button id="refresh-btn"  title="Refresh graph"
        style="padding:4px 8px;background:var(--vscode-button-secondaryBackground, var(--vscode-input-background));color:var(--vscode-button-secondaryForeground, var(--vscode-foreground));border:1px solid var(--vscode-input-border);border-radius:3px;font-size:14px;cursor:pointer;line-height:1;">
        &#128260;
      </button>
    </div>

    <!-- Main Content Area -->
    <div id="main-content" style="display:flex;position:relative;height:calc(100vh - 70px);overflow:hidden;">
      <!-- Graph Canvas -->
      <div id="graph-container" style="flex:1;position:relative;height:100%;min-width:0;overflow:hidden;">
        <div class="loading" id="loading">Loading knowledge graph...</div>
      </div>

      <!-- Node Tooltip (floating, hidden by default) -->
      <div id="node-tooltip" style="display:none;position:fixed;pointer-events:none;z-index:400;background:var(--vscode-editorHoverWidget-background, var(--vscode-editorWidget-background));border:1px solid var(--vscode-editorHoverWidget-border, var(--vscode-editorWidget-border));border-radius:4px;padding:6px 10px;font-size:12px;max-width:220px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        <div id="tooltip-title" style="font-weight:600;margin-bottom:2px;"></div>
        <div id="tooltip-type" style="opacity:0.7;font-size:11px;"></div>
      </div>

      <!-- Node Detail Sidebar -->
      <div id="detail-sidebar" style="display:flex;flex-direction:column;width:300px;min-width:300px;height:100%;background:var(--vscode-sideBar-background, var(--vscode-editor-background));border-left:2px solid var(--vscode-focusBorder, #007acc);overflow-y:auto;flex-shrink:0;z-index:100;">
        <div style="padding:12px;">
          <!-- Stats Grid -->
          <div id="sidebar-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
            <div style="background:var(--vscode-editorWidget-background, rgba(255,255,255,0.05));border-radius:4px;padding:8px;text-align:center;">
              <div id="stat-entries" style="font-size:1.1rem;font-weight:700;color:var(--vscode-charts-blue, #38bdf8);">—</div>
              <div style="font-size:10px;opacity:0.6;">Entries</div>
            </div>
            <div style="background:var(--vscode-editorWidget-background, rgba(255,255,255,0.05));border-radius:4px;padding:8px;text-align:center;">
              <div id="stat-edges" style="font-size:1.1rem;font-weight:700;color:var(--vscode-charts-blue, #38bdf8);">—</div>
              <div style="font-size:10px;opacity:0.6;">Edges</div>
            </div>
            <div style="background:var(--vscode-editorWidget-background, rgba(255,255,255,0.05));border-radius:4px;padding:8px;text-align:center;">
              <div id="stat-pinned" style="font-size:1.1rem;font-weight:700;color:var(--vscode-charts-blue, #38bdf8);">—</div>
              <div style="font-size:10px;opacity:0.6;">Pinned</div>
            </div>
            <div style="background:var(--vscode-editorWidget-background, rgba(255,255,255,0.05));border-radius:4px;padding:8px;text-align:center;">
              <div id="stat-tiers" style="font-size:1.1rem;font-weight:700;color:var(--vscode-charts-blue, #38bdf8);">—</div>
              <div style="font-size:10px;opacity:0.6;">Tiers</div>
            </div>
          </div>

          <!-- Recent Entries -->
          <div id="recent-section" style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;margin-bottom:6px;opacity:0.7;">RECENT ENTRIES</div>
            <div id="recent-entries" style="font-size:11px;opacity:0.6;">Loading...</div>
          </div>

          <!-- Divider -->
          <hr style="border:none;border-top:1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.1));margin:8px 0;" />

          <!-- Node Detail (shown on click) -->
          <div id="node-detail-section" style="display:none;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="font-size:11px;font-weight:600;opacity:0.7;">NODE DETAIL</div>
              <button id="sidebar-close" style="background:none;border:none;color:var(--vscode-foreground);font-size:14px;cursor:pointer;opacity:0.7;padding:2px 6px;border-radius:3px;">&#10005;</button>
            </div>

            <!-- Entry Title -->
            <h3 id="detail-title" style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:var(--vscode-foreground);"></h3>

            <!-- Entry Type Badge -->
            <div style="margin-bottom:10px;">
              <span id="detail-type" style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;"></span>
              <span id="detail-tier" style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:4px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);"></span>
            </div>

            <!-- Entry Content -->
            <div id="detail-content" style="font-size:12px;line-height:1.5;margin-bottom:12px;white-space:pre-wrap;color:var(--vscode-descriptionForeground, var(--vscode-foreground));max-height:200px;overflow-y:auto;"></div>

            <!-- Tags -->
            <div id="detail-tags-section" style="margin-bottom:12px;display:none;">
              <div style="font-size:11px;font-weight:600;margin-bottom:4px;opacity:0.7;">TAGS</div>
              <div id="detail-tags" style="display:flex;flex-wrap:wrap;gap:4px;"></div>
            </div>

            <!-- Citations -->
            <div id="detail-citations-section" style="display:none;">
              <div style="font-size:11px;font-weight:600;margin-bottom:4px;opacity:0.7;">CITATIONS</div>
              <div id="detail-citations" style="font-size:12px;line-height:1.6;"></div>
            </div>
          </div>

          <!-- Placeholder when no node selected -->
          <p id="sidebar-placeholder" style="opacity:0.5;font-size:11px;text-align:center;margin-top:8px;">Click a node to view details</p>
        </div>
      </div>
      <!-- Minimap -->
      <canvas id="minimap" width="160" height="120" style="position:absolute;bottom:12px;left:12px;z-index:150;background:rgba(0,0,0,0.6);border:1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.15));border-radius:4px;cursor:crosshair;"></canvas>
    </div>

    <!-- Footer -->
    <div id="footer" style="display:flex;align-items:center;justify-content:space-between;padding:4px 12px;background:var(--vscode-editorWidget-background, var(--vscode-sideBar-background));border-top:1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));font-size:11px;height:26px;">
      <!-- Legend (collapsible) -->
      <div id="legend" style="display:flex;align-items:center;gap:4px;overflow:hidden;">
        <button id="legend-toggle"  style="background:none;border:none;color:var(--vscode-foreground);font-size:11px;cursor:pointer;padding:2px 4px;opacity:0.8;">Legend &#9656;</button>
        <div id="legend-items" style="display:none;align-items:center;gap:8px;flex-wrap:nowrap;overflow-x:auto;">
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block;"></span>Decision</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;"></span>Error</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#8b5cf6;display:inline-block;"></span>Arch</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;"></span>Proc</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>Context</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#06b6d4;display:inline-block;"></span>Lesson</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#6366f1;display:inline-block;"></span>Code</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#ec4899;display:inline-block;"></span>Req</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#14b8a6;display:inline-block;"></span>API</span>
        </div>
      </div>

      <!-- Node Count Badge -->
      <span id="node-count" style="background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap;"></span>
    </div>

    <!-- Inline script for UI interactions (toolbar, filters, sidebar) -->
    <script nonce="${nonce}">
      // --- Dropdown toggle ---
      function toggleDropdown(id) {
        const el = document.getElementById(id);
        const isVisible = el.style.display !== 'none';
        document.querySelectorAll('.dropdown-panel').forEach(d => d.style.display = 'none');
        if (!isVisible) el.style.display = 'block';
      }
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-dropdown')) {
          document.querySelectorAll('.dropdown-panel').forEach(d => d.style.display = 'none');
        }
      });

      // --- Type Filter ---
      function applyTypeFilter() {
        const checked = [...document.querySelectorAll('#type-dropdown input[type=checkbox]:checked')].map(cb => cb.value);
        vscode.postMessage({ type: 'filterByType', types: checked });
      }

      // --- Tier Filter ---
      function applyTierFilter() {
        const checked = [...document.querySelectorAll('#tier-dropdown input[type=checkbox]:checked')].map(cb => cb.value);
        vscode.postMessage({ type: 'filterByTier', tiers: checked });
      }

      // --- Search ---
      let searchTimeout = null;
      function handleSearch(value) {
        clearTimeout(searchTimeout);
        if (value.length >= 2) {
          searchTimeout = setTimeout(() => {
            vscode.postMessage({ type: 'searchNodes', query: value });
          }, 300);
        } else if (value.length === 0) {
          vscode.postMessage({ type: 'searchNodes', query: '' });
        }
      }

      // --- Layout Toggle ---
      function setLayout(mode) {
        const btn2d = document.getElementById('btn-2d');
        const btn3d = document.getElementById('btn-3d');
        if (mode === '2d') {
          btn2d.style.background = 'var(--vscode-button-background)';
          btn2d.style.color = 'var(--vscode-button-foreground)';
          btn3d.style.background = 'var(--vscode-input-background)';
          btn3d.style.color = 'var(--vscode-foreground)';
        } else {
          btn3d.style.background = 'var(--vscode-button-background)';
          btn3d.style.color = 'var(--vscode-button-foreground)';
          btn2d.style.background = 'var(--vscode-input-background)';
          btn2d.style.color = 'var(--vscode-foreground)';
        }
        if (typeof setGraphLayout === 'function') setGraphLayout(mode);
      }

      // --- Refresh ---
      function handleRefresh() {
        const btn = document.getElementById('refresh-btn');
        btn.disabled = true;
        btn.style.opacity = '0.5';
        vscode.postMessage({ type: 'refresh' });
        setTimeout(() => { btn.disabled = false; btn.style.opacity = '1'; }, 2000);
      }

      // --- Legend Toggle ---
      let legendOpen = false;
      function toggleLegend() {
        legendOpen = !legendOpen;
        const items = document.getElementById('legend-items');
        const toggle = document.getElementById('legend-toggle');
        items.style.display = legendOpen ? 'flex' : 'none';
        toggle.innerHTML = legendOpen ? 'Legend &#9662;' : 'Legend &#9656;';
      }

      // --- Node Detail Sidebar ---
      function closeSidebar() {
        document.getElementById('node-detail-section').style.display = 'none';
        document.getElementById('sidebar-placeholder').style.display = 'block';
      }

      function showNodeDetail(entry) {
        document.getElementById('sidebar-placeholder').style.display = 'none';
        document.getElementById('node-detail-section').style.display = 'block';

        document.getElementById('detail-title').textContent = entry.title || entry.summary || '';
        
        const typeEl = document.getElementById('detail-type');
        typeEl.textContent = entry.type || '';
        const typeColors = { DECISION:'#3b82f6', ERROR_PATTERN:'#ef4444', ARCHITECTURE:'#8b5cf6', PROCEDURE:'#10b981', CONTEXT:'#f59e0b', LESSON_LEARNED:'#06b6d4', CODE_ENTITY:'#6366f1', REQUIREMENT:'#ec4899', API_DESIGN:'#14b8a6' };
        typeEl.style.background = (typeColors[entry.type] || '#607D8B') + '33';
        typeEl.style.color = typeColors[entry.type] || '#607D8B';

        document.getElementById('detail-tier').textContent = entry.tier || '';
        document.getElementById('detail-content').textContent = entry.content || '';

        const tagsSection = document.getElementById('detail-tags-section');
        const tagsEl = document.getElementById('detail-tags');
        if (entry.tags && entry.tags.length > 0) {
          tagsSection.style.display = 'block';
          tagsEl.innerHTML = entry.tags.map(function(t) { return '<span style="padding:2px 6px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:8px;font-size:10px;">' + t + '</span>'; }).join('');
        } else {
          tagsSection.style.display = 'none';
        }

        const citSection = document.getElementById('detail-citations-section');
        const citEl = document.getElementById('detail-citations');
        if (entry.citations && entry.citations.length > 0) {
          citSection.style.display = 'block';
          citEl.innerHTML = entry.citations.map(function(c) { return '<div style="padding:2px 0;border-bottom:1px solid var(--vscode-editorWidget-border);margin-bottom:4px;">' + c + '</div>'; }).join('');
        } else {
          citSection.style.display = 'none';
        }
      }

      // --- Tooltip ---
      function showTooltip(x, y, title, type) {
        const tip = document.getElementById('node-tooltip');
        document.getElementById('tooltip-title').textContent = title;
        document.getElementById('tooltip-type').textContent = type;
        tip.style.left = (x + 12) + 'px';
        tip.style.top = (y - 8) + 'px';
        tip.style.display = 'block';
      }
      function hideTooltip() {
        document.getElementById('node-tooltip').style.display = 'none';
      }

      // --- Handle messages from extension ---
      function handlePanelMessage(msg) {
        if (msg.type === 'entryDetail') {
          showNodeDetail(msg.entry);
        }
        if (msg.type === 'graphData') {
          document.getElementById('loading').style.display = 'none';
          var nodeCount = (msg.nodes || []).length;
          var edgeCount = (msg.edges || []).length;
          document.getElementById('node-count').textContent = nodeCount + ' entries, ' + edgeCount + ' edges';
          var btn = document.getElementById('refresh-btn');
          if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        }
        if (msg.type === 'sidebarStats') {
          var s = msg.stats || {};
          var el;
          el = document.getElementById('stat-entries'); if (el) el.textContent = s.totalEntries || '0';
          el = document.getElementById('stat-edges'); if (el) el.textContent = s.totalEdges || '0';
          el = document.getElementById('stat-pinned'); if (el) el.textContent = s.totalPinned || '0';
          el = document.getElementById('stat-tiers'); if (el) el.textContent = s.totalTiers || '0';
        }
        if (msg.type === 'recentEntries') {
          var recentEl = document.getElementById('recent-entries');
          var entries = msg.entries || [];
          if (recentEl) {
            if (entries.length === 0) {
              recentEl.innerHTML = '<div style="opacity:0.5">No entries yet</div>';
            } else {
              var typeColors = { DECISION:'#3b82f6', ERROR_PATTERN:'#ef4444', ARCHITECTURE:'#8b5cf6', PROCEDURE:'#10b981', CONTEXT:'#f59e0b', LESSON_LEARNED:'#06b6d4', CODE_ENTITY:'#6366f1', REQUIREMENT:'#ec4899', API_DESIGN:'#14b8a6' };
              recentEl.innerHTML = entries.map(function(e) {
                var color = typeColors[e.type] || '#607D8B';
                return '<div class="recent-entry-item" data-entry-id="' + e.id + '" style="padding:4px 0;border-bottom:1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.06));cursor:pointer;">' +
                  '<span style="color:' + color + ';font-size:10px;font-weight:600;">' + (e.type || 'CONTEXT') + '</span>' +
                  '<div style="font-size:11px;opacity:0.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (e.summary || 'Entry #' + e.id) + '</div></div>';
              }).join('');
            }
          }
        }
      }
    </script>`;

    return this.getBaseHtml(webview, body, ["three.min.js", "3d-force-graph.min.js", "graph.js"], ["ui-tokens.css", "panel-common.css"]);
  }

  async loadData(): Promise<void> {
    try {
      // Try to get full graph data from viewer API (same source as web dashboard)
      let nodes: GraphNode[] = [];
      let edges: GraphEdge[] = [];
      let usedViewerApi = false;

      try {
        const port = this.mcpManager.port;
        if (port && port > 0) {
          const resp = await fetch(`http://127.0.0.1:${port}/api/memory/graph/data?limit=15000`);
          if (resp.ok) {
            const data = (await resp.json()) as any;
            if (data.nodes && data.edges && data.nodes.length > 0) {
              nodes = data.nodes.map((n: any) => ({
                id: n.id,
                title: (n.summary || "").substring(0, 50),
                type: n.type || "CONTEXT",
                tier: n.tier || "SEMANTIC",
                color: NODE_TYPE_COLORS[n.type] || NODE_TYPE_COLORS.CONTEXT,
                size: 12,
              }));
              edges = data.edges.map((e: any) => ({
                source: e.source || e.source_id,
                target: e.target || e.target_id,
                relation: e.relation || "RELATED",
              }));
              usedViewerApi = true;
            }
          }
        }
      } catch { /* fallback */ }

      // Fallback: load via MCP tools
      if (!usedViewerApi) {
        // Use mem_search with wildcard to get entries (mem_crud may not be available)
        let allEntries: any[] = [];
        const types = ["REQUIREMENT", "ARCHITECTURE", "DECISION", "PROCEDURE", "API_DESIGN", "LESSON_LEARNED", "ERROR_PATTERN", "CONTEXT"];
        for (const t of types) {
          try {
            const raw = await this.mcpManager.invokeTool("mem_search", { query: t, limit: 50, detail: true });
            const parsed = this.parseSearchResults(raw);
            allEntries.push(...parsed);
          } catch { /* skip */ }
        }

        const seen = new Set<number>();
        allEntries = allEntries.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });

        nodes = allEntries.map((e: any) => ({
          id: e.id,
          title: (e.summary || e.title || "").substring(0, 50),
          type: e.type || "CONTEXT",
          tier: e.tier || "SEMANTIC",
          color: NODE_TYPE_COLORS[e.type] || NODE_TYPE_COLORS.CONTEXT,
          size: 12,
        }));

        edges = await this.loadEdges(allEntries);
      }

      this.sendMessage({ type: "graphData", nodes, edges });
      await this.loadSidebarStats(nodes.length, edges.length);
      await this.loadRecentEntries(nodes);
    } catch (err) {
      this.sendMessage({ type: "error", message: `Failed to load graph: ${(err as Error).message}`, retryable: true });
    }
  }

  private async loadEdges(entries: any[]): Promise<GraphEdge[]> {
    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>();
    
    // Try to get all edges via HTTP viewer endpoint (fast, returns all edges at once)
    try {
      // Use MCP port — viewer is proxied on same port
      const port = this.mcpManager.port;
      if (port && port > 0) {
        const resp = await fetch(`http://127.0.0.1:${port}/api/memory/graph/data?limit=15000`);
        if (resp.ok) {
          const data = (await resp.json()) as any;
          if (data.edges && Array.isArray(data.edges) && data.edges.length > 0) {
            return data.edges.map((e: any) => ({
              source: e.source || e.source_id,
              target: e.target || e.target_id,
              relation: e.relation || "RELATED",
            }));
          }
        }
      }
    } catch { /* fallback to MCP tool */ }

    // Fallback: Query neighbors for non-CONTEXT nodes
    const candidates = entries.filter(e => e.type !== "CONTEXT").slice(0, 50);
    
    for (let i = 0; i < candidates.length; i++) {
      try {
        const raw = await this.mcpManager.invokeTool("mem_graph", { action: "neighbors", node_id: candidates[i].id });
        const parsed = this.parseNeighborEdges(raw, candidates[i].id);
        for (const edge of parsed) {
          const key = `${Math.min(edge.source, edge.target)}-${Math.max(edge.source, edge.target)}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push(edge);
          }
        }
      } catch { /* skip */ }
    }
    return edges;
  }

  private parseNeighborEdges(raw: string, sourceId: number): GraphEdge[] {
    const edges: GraphEdge[] = [];
    if (raw.includes("no connections")) return edges;
    const lines = raw.split("\n");
    for (const line of lines) {
      // Format: "  → [ID] Summary" or "  ← [ID] Summary"
      const match = line.match(/[→←]\s+\[(\d+)\]/);
      if (match) {
        const targetId = parseInt(match[1], 10);
        edges.push({
          source: sourceId,
          target: targetId,
          relation: "SIBLING",
        });
      }
    }
    return edges;
  }

  private async loadSidebarStats(totalEntries: number, totalEdges: number): Promise<void> {
    try {
      let totalPinned = 0;
      let totalTiers = 0;
      try {
        const statusRaw = await this.mcpManager.invokeTool("mem_admin", { action: "status" });
        const statusMatch = statusRaw.match(/Total entries:\s*(\d+)/i);
        const edgeMatch = statusRaw.match(/Total edges:\s*(\d+)/i);
        const pinnedMatch = statusRaw.match(/Pinned:\s*(\d+)/i);
        if (statusMatch) totalEntries = parseInt(statusMatch[1], 10);
        if (edgeMatch) totalEdges = parseInt(edgeMatch[1], 10);
        if (pinnedMatch) totalPinned = parseInt(pinnedMatch[1], 10);
        // Count tiers from breakdown
        const tierMatches = statusRaw.match(/WORKING|EPISODIC|SEMANTIC|PROCEDURAL/g);
        if (tierMatches) totalTiers = new Set(tierMatches).size;
      } catch { /* use fallback counts */ }

      this.sendMessage({
        type: "sidebarStats",
        stats: { totalEntries, totalEdges, totalPinned, totalTiers },
      } as any);
    } catch { /* non-critical */ }
  }

  private async loadRecentEntries(allNodes: GraphNode[]): Promise<void> {
    try {
      const recent = allNodes.slice(0, 10).map((n: GraphNode) => ({
        id: n.id,
        type: n.type || "CONTEXT",
        summary: (n.title || "").substring(0, 60),
      }));
      this.sendMessage({ type: "recentEntries", entries: recent } as any);
    } catch { /* non-critical */ }
  }

  async handleMessage(msg: WebviewToExtMessage): Promise<void> {
    switch (msg.type) {
      case "ready":
      case "refresh":
        await this.loadData();
        break;
      case "nodeClick":
        if (msg.type === "nodeClick") {
          try {
            const raw = await this.mcpManager.invokeTool("mem_crud", { action: "get", id: msg.entryId });
            let entry: any;
            try {
              entry = JSON.parse(raw);
            } catch {
              // mem_crud(get) returns text format — parse it
              entry = this.parseEntryText(raw, msg.entryId);
            }
            if (entry) {
              this.sendMessage({ type: "entryDetail", entry });
            }
          } catch { /* node may have been deleted */ }
        }
        break;
      case "filterByType":
      case "searchNodes":
        await this.loadData();
        break;
      case "manualRetry":
        try { await this.mcpManager.restart(); } catch { this.sendMessage({ type: "serverStatus", status: "failed" }); }
        break;
    }
  }

  private parseEntries(raw: string): any[] {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : p.entries || [];
    } catch {
      // Parse text format: "#ID [TYPE] Summary\n   Tier: X | Confidence: Y | Access: Z"
      const entries: any[] = [];
      const lines = raw.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^#(\d+)\s+\[(\w+)\]\s+(.+)/);
        if (match) {
          let tier = "SEMANTIC";
          // Next line may have tier info
          if (i + 1 < lines.length) {
            const tierMatch = lines[i + 1].match(/Tier:\s*(\w+)/);
            if (tierMatch) tier = tierMatch[1];
          }
          entries.push({
            id: parseInt(match[1], 10),
            type: match[2],
            summary: match[3].trim(),
            tier,
            citations: 0,
          });
        }
      }
      return entries;
    }
  }

  private parseSearchResults(raw: string): any[] {
    // Parse mem_search output format:
    // [TYPE] Summary text
    //   ID: 123 | Tier: SEMANTIC | Score: 0.015 | Source: path
    const entries: any[] = [];
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const typeMatch = lines[i].match(/^\[(\w+)\]\s+(.+)/);
      if (typeMatch) {
        const type = typeMatch[1];
        const summary = typeMatch[2].trim();
        let id = 0, tier = "SEMANTIC", source = "";
        if (i + 1 < lines.length) {
          const idMatch = lines[i + 1].match(/ID:\s*(\d+)/);
          const tierMatch = lines[i + 1].match(/Tier:\s*(\w+)/);
          const sourceMatch = lines[i + 1].match(/Source:\s*(.+?)(?:\s*$|\s*\|)/);
          if (idMatch) id = parseInt(idMatch[1], 10);
          if (tierMatch) tier = tierMatch[1];
          if (sourceMatch) source = sourceMatch[1].trim();
        }
        if (id > 0) {
          entries.push({ id, type, summary, tier, source, citations: 0 });
        }
      }
    }
    return entries;
  }

  private parseEntryText(raw: string, id: number): any {
    // Parse text format from mem_crud(get):
    // "Entry #ID\nType: X\nTier: Y\nSummary: ...\nContent: ...\nTags: a, b, c"
    const lines = raw.split("\n");
    const entry: any = { id, title: "", type: "CONTEXT", tier: "SEMANTIC", content: raw, tags: [] };
    for (const line of lines) {
      if (line.startsWith("Type:")) entry.type = line.replace("Type:", "").trim();
      else if (line.startsWith("Tier:")) entry.tier = line.replace("Tier:", "").trim();
      else if (line.startsWith("Summary:")) entry.title = line.replace("Summary:", "").trim();
      else if (line.startsWith("Tags:")) entry.tags = line.replace("Tags:", "").trim().split(",").map((t: string) => t.trim()).filter(Boolean);
      else if (line.startsWith("Content:")) entry.content = line.replace("Content:", "").trim();
    }
    if (!entry.title) entry.title = lines[0]?.substring(0, 60) || `Entry #${id}`;
    return entry;
  }

  private parseEdges(raw: string): GraphEdge[] {
    try {
      const p = JSON.parse(raw);
      const items = p.neighbors || p.edges || (Array.isArray(p) ? p : []);
      return items.map((n: any) => ({
        source: n.source_id || n.from || n.source,
        target: n.target_id || n.to || n.target,
        relation: n.relation || "RELATED",
      }));
    } catch {
      // Parse text format: "→ #ID (RELATION) Summary"
      const edges: GraphEdge[] = [];
      const lines = raw.split("\n");
      for (const line of lines) {
        const match = line.match(/[→←]\s+#(\d+)\s+\((\w+)\)/);
        if (match) {
          edges.push({
            source: 1,
            target: parseInt(match[1], 10),
            relation: match[2] || "RELATED",
          });
        }
      }
      return edges;
    }
  }
}

