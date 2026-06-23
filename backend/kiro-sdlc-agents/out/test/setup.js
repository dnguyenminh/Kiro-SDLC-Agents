"use strict";
/**
 * Mocha test setup — pre-populates the require cache with a mock 'vscode' module
 * so that source files importing vscode can be loaded outside the extension host.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Module = require("module");
const mockModule = require("./mocks/vscode");
// Intercept filename resolution for 'vscode'
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
    if (request === "vscode") {
        return "vscode";
    }
    return originalResolve.apply(this, arguments);
};
// Create a fake module entry for 'vscode'
const fakeModule = new Module("vscode");
fakeModule.filename = "vscode";
fakeModule.loaded = true;
fakeModule.exports = mockModule;
// Insert into cache — Node resolves 'vscode' and checks cache first
Module._cache["vscode"] = fakeModule;
//# sourceMappingURL=setup.js.map