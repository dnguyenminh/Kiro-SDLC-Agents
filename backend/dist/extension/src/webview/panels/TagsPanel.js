/**
 * TagsPanel — tag management webview with CRUD operations.
 * Implements TDD §5.1 panels/TagsPanel.ts, FSD UC-5.
 */
import * as vscode from 'vscode';
export class TagsPanel {
    panel = null;
    dataFetcher;
    constructor(dataFetcher, _extensionUri) {
        this.dataFetcher = dataFetcher;
    }
    show() {
        if (this.panel) {
            this.panel.reveal();
            this.refresh();
            return;
        }
        this.panel = vscode.window.createWebviewPanel('codeIntel.tags', 'Tags', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        this.panel.onDidDispose(() => {
            this.panel = null;
        });
        this.panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'refresh') {
                await this.refresh();
            }
            else if (msg.type === 'createTag') {
                await this.createTag(msg.name);
            }
            else if (msg.type === 'deleteTag') {
                await this.deleteTag(msg.id);
            }
        });
        this.panel.webview.html = this.getHtml();
        this.refresh();
    }
    async refresh() {
        if (!this.panel)
            return;
        const data = await this.dataFetcher.fetch('/api/tags/list');
        this.panel.webview.postMessage({ type: 'update', data });
    }
    close() {
        this.panel?.dispose();
        this.panel = null;
    }
    async createTag(name) {
        await this.dataFetcher.post('/api/tags', { name });
        await this.refresh();
    }
    async deleteTag(id) {
        await this.dataFetcher.post('/api/tags/' + id + '/delete', {});
        await this.refresh();
    }
    getHtml() {
        return [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '  <title>Tags</title>',
            '  <style>',
            '    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }',
            '    .tag-list { list-style: none; padding: 0; }',
            '    .tag-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; margin: 4px 0; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }',
            '    .tag-name { font-weight: bold; }',
            '    .tag-count { opacity: 0.7; font-size: 0.85em; }',
            '    .add-form { display: flex; gap: 8px; margin-bottom: 16px; }',
            '    input { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px 10px; border-radius: 4px; flex: 1; }',
            '    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }',
            '    button:hover { background: var(--vscode-button-hoverBackground); }',
            '    .loading { text-align: center; padding: 40px; opacity: 0.7; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <h2>Tags</h2>',
            '  <div class="add-form">',
            '    <input id="tagInput" placeholder="New tag name..." />',
            '    <button onclick="addTag()">Add</button>',
            '  </div>',
            '  <div id="root"><div class="loading">Loading tags...</div></div>',
            '  <script>',
            '    const vscode = acquireVsCodeApi();',
            '    function addTag() {',
            '      const input = document.getElementById("tagInput");',
            '      if (input.value.trim()) {',
            '        vscode.postMessage({ type: "createTag", name: input.value.trim() });',
            '        input.value = "";',
            '      }',
            '    }',
            '    window.addEventListener("message", (event) => {',
            '      const msg = event.data;',
            '      if (msg.type === "update" && msg.data && msg.data.tags) {',
            '        let html = "<ul class=\\"tag-list\\">";',
            '        for (const tag of msg.data.tags) {',
            '          html += "<li class=\\"tag-item\\"><span class=\\"tag-name\\">" + tag.name + "</span><span class=\\"tag-count\\">" + tag.count + " entries</span></li>";',
            '        }',
            '        html += "</ul>";',
            '        document.getElementById("root").innerHTML = html;',
            '      }',
            '    });',
            '  </script>',
            '</body>',
            '</html>',
        ].join('\n');
    }
}
//# sourceMappingURL=TagsPanel.js.map