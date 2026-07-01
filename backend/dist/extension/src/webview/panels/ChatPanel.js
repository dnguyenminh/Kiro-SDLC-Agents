/**
 * ChatPanel — AI Chat webview panel with SSE streaming.
 * KSA-292: New panel (TDD §4.5).
 */
import * as vscode from 'vscode';
export class ChatPanel {
    panel = null;
    extensionUri;
    client;
    authManager;
    outputChannel;
    sessionId = null;
    messages = [];
    constructor(client, authManager, extensionUri, outputChannel) {
        this.client = client;
        this.authManager = authManager;
        this.extensionUri = extensionUri;
        this.outputChannel = outputChannel;
    }
    show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }
        this.panel = vscode.window.createWebviewPanel('codeIntel.chat', 'Code Intel Chat', vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.extensionUri],
        });
        this.panel.onDidDispose(() => {
            this.panel = null;
        });
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'sendMessage':
                    await this.handleSendMessage(message.text, message.context ?? []);
                    break;
                case 'newSession':
                    this.sessionId = null;
                    this.messages = [];
                    break;
            }
        });
        this.panel.webview.html = this.getHtml();
    }
    close() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }
    async handleSendMessage(text, context) {
        if (!this.authManager.isAuthenticated) {
            this.postToWebview({ type: 'error', message: 'Please login first' });
            return;
        }
        // Add user message
        this.messages.push({ role: 'user', content: text, timestamp: Date.now() });
        this.postToWebview({ type: 'chat:userMessage', content: text });
        try {
            const body = {
                message: text,
                context,
                session_id: this.sessionId,
            };
            // Stream response via SSE
            const stream = await this.client.streamChat('/api/chat', body);
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            // Signal start of assistant response
            this.postToWebview({ type: 'chat:start' });
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                fullResponse += chunk;
                this.postToWebview({ type: 'chat:chunk', content: chunk });
            }
            // Signal end of response
            this.postToWebview({ type: 'chat:end' });
            this.messages.push({ role: 'assistant', content: fullResponse, timestamp: Date.now() });
        }
        catch (error) {
            const msg = error.message;
            this.log('Chat error: ' + msg);
            this.postToWebview({ type: 'error', message: 'Chat failed: ' + msg });
        }
    }
    postToWebview(message) {
        this.panel?.webview.postMessage(message);
    }
    getHtml() {
        return [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '  <title>Code Intel Chat</title>',
            '  <style>',
            '    * { box-sizing: border-box; margin: 0; padding: 0; }',
            '    body { font-family: var(--vscode-font-family); height: 100vh; display: flex; flex-direction: column; color: var(--vscode-foreground); background: var(--vscode-editor-background); }',
            '    #messages { flex: 1; overflow-y: auto; padding: 16px; }',
            '    .message { margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; max-width: 85%; white-space: pre-wrap; }',
            '    .user { background: var(--vscode-button-background); color: var(--vscode-button-foreground); margin-left: auto; }',
            '    .assistant { background: var(--vscode-editor-inactiveSelectionBackground); }',
            '    .error { color: var(--vscode-errorForeground); font-style: italic; }',
            '    #input-area { display: flex; padding: 8px; border-top: 1px solid var(--vscode-panel-border); }',
            '    #input { flex: 1; padding: 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; resize: none; }',
            '    #send { margin-left: 8px; padding: 8px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; }',
            '    #send:hover { background: var(--vscode-button-hoverBackground); }',
            '  </style>',
            '</head>',
            '<body>',
            '  <div id="messages"></div>',
            '  <div id="input-area">',
            '    <textarea id="input" rows="2" placeholder="Ask anything..."></textarea>',
            '    <button id="send">Send</button>',
            '  </div>',
            '  <script>',
            '    const vscode = acquireVsCodeApi();',
            '    const messagesEl = document.getElementById("messages");',
            '    const inputEl = document.getElementById("input");',
            '    const sendBtn = document.getElementById("send");',
            '    let currentAssistantEl = null;',
            '',
            '    function addMessage(role, content) {',
            '      const div = document.createElement("div");',
            '      div.className = "message " + role;',
            '      div.textContent = content;',
            '      messagesEl.appendChild(div);',
            '      messagesEl.scrollTop = messagesEl.scrollHeight;',
            '      return div;',
            '    }',
            '',
            '    sendBtn.addEventListener("click", () => send());',
            '    inputEl.addEventListener("keydown", (e) => {',
            '      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }',
            '    });',
            '',
            '    function send() {',
            '      const text = inputEl.value.trim();',
            '      if (!text) return;',
            '      inputEl.value = "";',
            '      vscode.postMessage({ type: "sendMessage", text });',
            '    }',
            '',
            '    window.addEventListener("message", (event) => {',
            '      const msg = event.data;',
            '      switch (msg.type) {',
            '        case "chat:userMessage": addMessage("user", msg.content); break;',
            '        case "chat:start": currentAssistantEl = addMessage("assistant", ""); break;',
            '        case "chat:chunk": if (currentAssistantEl) currentAssistantEl.textContent += msg.content; messagesEl.scrollTop = messagesEl.scrollHeight; break;',
            '        case "chat:end": currentAssistantEl = null; break;',
            '        case "error": addMessage("error", msg.message); break;',
            '      }',
            '    });',
            '  </script>',
            '</body>',
            '</html>',
        ].join('\n');
    }
    log(message) {
        this.outputChannel.appendLine('[ChatPanel] ' + message);
    }
    dispose() {
        this.close();
    }
}
//# sourceMappingURL=ChatPanel.js.map