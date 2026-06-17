/**
 * GitDiffProvider — Git diff resolution
 * KSA-252
 */
export declare class GitDiffProvider {
    private workspaceRoot;
    constructor(workspaceRoot: string);
    getDiff(): Promise<string>;
}
//# sourceMappingURL=GitDiffProvider.d.ts.map