/**
 * SpecProvider — .kiro/specs/ directory reading
 * KSA-252
 */
export declare class SpecProvider {
    private workspaceRoot;
    private specsDir;
    constructor(workspaceRoot: string);
    getList(): Promise<string[]>;
    getContent(specName: string): Promise<{
        requirements: string;
        design: string;
        tasks: string;
    }>;
    private readFile;
}
//# sourceMappingURL=SpecProvider.d.ts.map