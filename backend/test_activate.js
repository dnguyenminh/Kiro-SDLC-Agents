const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'vscode') {
    class DummyClass {}
    return {
      workspace: { 
        getConfiguration: () => ({ get: () => {} }),
        onDidChangeConfiguration: () => ({ dispose: () => {} })
      },
      window: { 
        createOutputChannel: () => ({ appendLine: console.log }),
        registerWebviewViewProvider: () => ({ dispose: () => {} }),
        createTreeView: () => ({ dispose: () => {} })
      },
      commands: { registerCommand: () => ({ dispose: () => {} }) },
      ExtensionContext: DummyClass,
      TreeItem: DummyClass,
      EventEmitter: DummyClass,
      TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
      ThemeIcon: DummyClass,
      Disposable: { from: () => ({ dispose: () => {} }) },
      Uri: { file: (f) => ({ fsPath: f }) }
    };
  }
  return originalRequire.apply(this, arguments);
};

try {
  const ext = require('C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js');
  console.log('Successfully required extension.js');
  
  const mockContext = {
    subscriptions: [],
    extensionPath: 'C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0',
    globalState: { get: () => {}, update: () => {} }
  };
  
  ext.activate(mockContext);
  console.log('Successfully called activate()');
} catch (e) {
  console.error('Error:', e.stack);
}
