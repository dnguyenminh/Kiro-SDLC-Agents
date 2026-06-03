"use strict";
/**
 * Error codes and factory for Salesforce Intelligence MCP servers.
 * Follows existing mcp-code-intelligence-nodejs error handling pattern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Errors = exports.SfToolError = void 0;
class SfToolError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'SfToolError';
    }
    toJSON() {
        return JSON.stringify({ error: this.code, message: this.message });
    }
}
exports.SfToolError = SfToolError;
/** Error factory functions with standardized codes */
exports.Errors = {
    fileNotFound: (path) => new SfToolError('SF-001', `File not found: ${path}`),
    unsupportedType: (ext) => new SfToolError('SF-002', `Unsupported file type: ${ext}`),
    notSfdxProject: (path) => new SfToolError('SF-003', `No SFDX project found at: ${path}`),
    parseError: (file, err) => new SfToolError('SF-004', `Parse error in ${file}: ${err}`),
    parserInitFailed: (err) => new SfToolError('SF-005', `Parser initialization failed: ${err}`),
    kbUnavailable: () => new SfToolError('SF-006', 'Knowledge Base not accessible'),
    noGraph: () => new SfToolError('SF-007', 'No dependency graph available. Run sf_index_project first.'),
    memoryExceeded: () => new SfToolError('SF-008', 'Memory limit exceeded. Try indexing specific directories.'),
    alreadyIndexing: () => new SfToolError('SF-009', 'Indexing already in progress'),
    stateCorrupted: () => new SfToolError('SF-010', 'Index state corrupted, resetting'),
};
//# sourceMappingURL=errors.js.map