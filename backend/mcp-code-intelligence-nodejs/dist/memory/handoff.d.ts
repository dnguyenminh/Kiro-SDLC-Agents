/**
 * AgentHandoffMemory — preserves context between agent sessions.
 * Structured handoff records with decisions, questions, artifacts.
 */
export interface HandoffContext {
    fromAgent: string;
    toAgent: string;
    summary: string;
    keyDecisions: string[];
    openQuestions: string[];
    artifacts: string[];
    ticketKey?: string;
}
export declare class AgentHandoffMemory {
    private repo;
    private searchRepo;
    constructor(repo: any, searchRepo: any);
    /** Record a handoff between agents. */
    recordHandoff(ctx: HandoffContext): number;
    /** Get recent handoffs for an agent. */
    getHandoffsForAgent(agentName: string, limit?: number): any[];
    /** Get latest handoff context for a ticket. */
    getLatestForTicket(ticketKey: string): any | null;
    private formatHandoff;
}
//# sourceMappingURL=handoff.d.ts.map