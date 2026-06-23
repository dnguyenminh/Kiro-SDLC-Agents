/**
 * SteeringProvider — .kiro/steering/ files reading
 * KSA-252
 */
export declare class SteeringProvider {
    private steeringDir;
    constructor(workspaceRoot: string);
    getList(): Promise<string[]>;
    getContent(fileName: string): Promise<string>;
}
//# sourceMappingURL=SteeringProvider.d.ts.map