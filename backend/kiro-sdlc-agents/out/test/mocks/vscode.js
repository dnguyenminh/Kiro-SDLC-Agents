"use strict";
/**
 * Mock vscode module for unit testing outside the extension host.
 * Provides stubs for commonly used VS Code APIs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Disposable = exports.workspace = exports.commands = exports.window = exports.Uri = exports.ViewColumn = exports.ThemeIcon = exports.TreeItem = exports.TreeItemCollapsibleState = exports.EventEmitter = void 0;
class EventEmitter {
    listeners = [];
    event = (listener) => {
        this.listeners.push(listener);
        return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
    };
    fire(data) {
        this.listeners.forEach(l => l(data));
    }
    dispose() {
        this.listeners = [];
    }
}
exports.EventEmitter = EventEmitter;
var TreeItemCollapsibleState;
(function (TreeItemCollapsibleState) {
    TreeItemCollapsibleState[TreeItemCollapsibleState["None"] = 0] = "None";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Collapsed"] = 1] = "Collapsed";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Expanded"] = 2] = "Expanded";
})(TreeItemCollapsibleState || (exports.TreeItemCollapsibleState = TreeItemCollapsibleState = {}));
class TreeItem {
    label;
    collapsibleState;
    command;
    iconPath;
    description;
    children;
    constructor(label, collapsibleState = TreeItemCollapsibleState.None) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}
exports.TreeItem = TreeItem;
class ThemeIcon {
    id;
    constructor(id) {
        this.id = id;
    }
}
exports.ThemeIcon = ThemeIcon;
var ViewColumn;
(function (ViewColumn) {
    ViewColumn[ViewColumn["One"] = 1] = "One";
    ViewColumn[ViewColumn["Two"] = 2] = "Two";
    ViewColumn[ViewColumn["Three"] = 3] = "Three";
})(ViewColumn || (exports.ViewColumn = ViewColumn = {}));
class Uri {
    scheme;
    path;
    fsPath;
    constructor(scheme, path) {
        this.scheme = scheme;
        this.path = path;
        this.fsPath = path;
    }
    static file(path) {
        return new Uri("file", path);
    }
    static joinPath(base, ...segments) {
        return new Uri(base.scheme, [base.path, ...segments].join("/"));
    }
    toString() {
        return `${this.scheme}://${this.path}`;
    }
}
exports.Uri = Uri;
exports.window = {
    createWebviewPanel: (_viewType, _title, _column, _options) => {
        const webview = {
            html: "",
            postMessage: () => Promise.resolve(true),
            onDidReceiveMessage: () => ({ dispose: () => { } }),
            asWebviewUri: (uri) => uri,
            cspSource: "https://mock.csp",
        };
        return {
            webview,
            reveal: () => { },
            dispose: () => { },
            onDidDispose: () => ({ dispose: () => { } }),
            visible: true,
            viewType: _viewType,
            title: _title,
        };
    },
    showErrorMessage: () => Promise.resolve(undefined),
    showWarningMessage: () => Promise.resolve(undefined),
    showInformationMessage: () => Promise.resolve(undefined),
    createOutputChannel: () => ({
        appendLine: () => { },
        append: () => { },
        show: () => { },
        dispose: () => { },
    }),
};
exports.commands = {
    registerCommand: () => ({ dispose: () => { } }),
    executeCommand: () => Promise.resolve(),
};
exports.workspace = {
    workspaceFolders: [{ uri: Uri.file("/test-workspace"), name: "test", index: 0 }],
    getConfiguration: () => ({
        get: (key, defaultValue) => defaultValue,
        update: () => Promise.resolve(),
    }),
};
class Disposable {
    callOnDispose;
    constructor(callOnDispose) {
        this.callOnDispose = callOnDispose;
    }
    dispose() { this.callOnDispose(); }
    static from(...disposables) {
        return new Disposable(() => disposables.forEach(d => d.dispose()));
    }
}
exports.Disposable = Disposable;
//# sourceMappingURL=vscode.js.map