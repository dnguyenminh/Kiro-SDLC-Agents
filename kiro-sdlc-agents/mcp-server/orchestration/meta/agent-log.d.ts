/**
 * agent_log meta-tool — logs agent activity to .code-intel/agent-log.jsonl.
 */
export declare const AGENT_LOG_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            ticket_key: {
                type: string;
                description: string;
            };
            agent_name: {
                type: string;
                description: string;
            };
            step: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                description: string;
            };
            message: {
                type: string;
                description: string;
            };
            artifacts: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function executeAgentLog(args: Record<string, any>, workspace: string): string;
//# sourceMappingURL=agent-log.d.ts.map