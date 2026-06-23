/**
 * DecisionMemory — tracks architectural decisions and their rationale.
 */
export interface Decision {
    title: string;
    context: string;
    decision: string;
    rationale: string;
    alternatives?: string[];
    consequences?: string;
    source?: string;
    tags?: string;
}
export declare class DecisionMemory {
    private repo;
    private graphRepo;
    constructor(repo: any, graphRepo: any);
    /** Record a new decision. */
    recordDecision(decision: Decision): number;
    /** Link a decision to related entries. */
    linkDecision(decisionId: number, relatedId: number, relation?: string): void;
    /** Find decisions. */
    findDecisions(limit?: number): any[];
    private formatContent;
}
//# sourceMappingURL=decision.d.ts.map