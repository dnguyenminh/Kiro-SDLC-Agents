/**
 * LoginPanel — Webview for username/password login + SSO button.
 * Implements TDD §5.2 LoginWebview, FSD UC-1, UC-2.
 */
import * as vscode from 'vscode';
export class LoginPanel {
    authManager;
    extensionUri;
    panel = null;
    baseUrl;
    disposables = [];
    constructor(authManager, extensionUri, baseUrl) {
        this.authManager = authManager;
        this.extensionUri = extensionUri;
        this.baseUrl = baseUrl;
    }
    /**
     * Show the Login Webview panel.
     */
    show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }
        this.panel = vscode.window.createWebviewPanel('codeIntel.login', 'Code Intelligence — Login', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: false,
            localResourceRoots: [this.extensionUri],
        });
        this.panel.webview.html = this.getHtml();
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'login':
                    await this.handleLogin(message.username, message.password);
                    break;
                case 'sso':
                    await this.handleSso();
                    break;
            }
        }, null, this.disposables);
        this.panel.onDidDispose(() => {
            this.panel = null;
        }, null, this.disposables);
    }
    /**
     * Close the Login panel.
     */
    close() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }
    async handleLogin(username, password) {
        this.authManager.setAuthenticating();
        this.postMessage({ type: 'loading', loading: true });
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                const errorData = (await response.json());
                this.postMessage({
                    type: 'error',
                    message: errorData.error.message,
                });
                this.authManager.setUnauthenticated();
                return;
            }
            const raw = await response.json();
            // Adapt backend response {token, user, expiresAt} to LoginResponse format
            const data = {
                access_token: raw.token || raw.access_token,
                refresh_token: raw.refresh_token || raw.token, // backend may not have refresh
                token_type: 'Bearer',
                expires_in: raw.expiresAt ? Math.floor((new Date(raw.expiresAt).getTime() - Date.now()) / 1000) : 3600,
                user: {
                    id: raw.user?.userId || raw.user?.id || '',
                    username: raw.user?.username || '',
                    email: raw.user?.email || '',
                    display_name: raw.user?.display_name || null,
                    role: (raw.user?.permissions?.includes('ADMIN') ? 'admin' : 'user'),
                    projects: raw.user?.projects || [],
                },
            };
            await this.authManager.storeLoginResult(data);
            this.close();
        }
        catch {
            this.postMessage({
                type: 'error',
                message: 'Cannot connect to Backend. Please ensure the server is running.',
            });
            this.authManager.setUnauthenticated();
        }
    }
    async handleSso() {
        // SSO flow — initiate PKCE authorization
        vscode.window.showInformationMessage('SSO login: Opening browser...');
        // Future: generate code_verifier, call /api/auth/sso/authorize, open browser
    }
    postMessage(message) {
        this.panel?.webview.postMessage(message);
    }
    getHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 40px 20px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 360px;
      width: 100%;
    }
    h1 {
      font-size: 1.4em;
      margin-bottom: 24px;
      text-align: center;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      font-size: 1em;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
    }
    input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    .btn {
      width: 100%;
      padding: 10px;
      font-size: 1em;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 8px;
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error-msg {
      color: var(--vscode-errorForeground);
      font-size: 0.85em;
      margin-top: 12px;
      text-align: center;
      display: none;
    }
    .divider {
      text-align: center;
      margin: 20px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Code Intelligence</h1>
    <form id="loginForm">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" autocomplete="username" required />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn btn-primary" id="loginBtn">Login</button>
    </form>
    <div class="error-msg" id="errorMsg"></div>
    <div class="divider">— or —</div>
    <button class="btn btn-secondary" id="ssoBtn">Login with SSO</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const ssoBtn = document.getElementById('ssoBtn');
    const errorMsg = document.getElementById('errorMsg');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      if (!username || !password) return;
      vscode.postMessage({ type: 'login', username, password });
    });

    ssoBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'sso' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'loading') {
        loginBtn.disabled = msg.loading;
        loginBtn.textContent = msg.loading ? 'Logging in...' : 'Login';
      } else if (msg.type === 'error') {
        errorMsg.style.display = 'block';
        errorMsg.textContent = msg.message;
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
      }
    });
  </script>
</body>
</html>`;
    }
    dispose() {
        this.close();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
//# sourceMappingURL=LoginPanel.js.map