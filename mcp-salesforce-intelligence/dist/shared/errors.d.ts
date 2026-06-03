/**
 * Error codes and factory for Salesforce Intelligence MCP servers.
 * Follows existing mcp-code-intelligence-nodejs error handling pattern.
 */
export declare class SfToolError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
    toJSON(): string;
}
/** Error factory functions with standardized codes */
export declare const Errors: {
    fileNotFound: (path: string) => SfToolError;
    unsupportedType: (ext: string) => SfToolError;
    notSfdxProject: (path: string) => SfToolError;
    parseError: (file: string, err: string) => SfToolError;
    parserInitFailed: (err: string) => SfToolError;
    kbUnavailable: () => SfToolError;
    noGraph: () => SfToolError;
    memoryExceeded: () => SfToolError;
    alreadyIndexing: () => SfToolError;
    stateCorrupted: () => SfToolError;
};
//# sourceMappingURL=errors.d.ts.map