/**
 * Error codes and factory for Salesforce Intelligence MCP servers.
 * Follows existing mcp-code-intelligence-nodejs error handling pattern.
 */

export class SfToolError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'SfToolError';
  }

  toJSON(): string {
    return JSON.stringify({ error: this.code, message: this.message });
  }
}

/** Error factory functions with standardized codes */
export const Errors = {
  fileNotFound: (path: string) =>
    new SfToolError('SF-001', `File not found: ${path}`),

  unsupportedType: (ext: string) =>
    new SfToolError('SF-002', `Unsupported file type: ${ext}`),

  notSfdxProject: (path: string) =>
    new SfToolError('SF-003', `No SFDX project found at: ${path}`),

  parseError: (file: string, err: string) =>
    new SfToolError('SF-004', `Parse error in ${file}: ${err}`),

  parserInitFailed: (err: string) =>
    new SfToolError('SF-005', `Parser initialization failed: ${err}`),

  kbUnavailable: () =>
    new SfToolError('SF-006', 'Knowledge Base not accessible'),

  noGraph: () =>
    new SfToolError('SF-007', 'No dependency graph available. Run sf_index_project first.'),

  memoryExceeded: () =>
    new SfToolError('SF-008', 'Memory limit exceeded. Try indexing specific directories.'),

  alreadyIndexing: () =>
    new SfToolError('SF-009', 'Indexing already in progress'),

  stateCorrupted: () =>
    new SfToolError('SF-010', 'Index state corrupted, resetting'),
};
