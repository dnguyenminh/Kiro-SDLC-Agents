/**
 * manage_auto_approve meta-tool — add/remove tools from auto-approve list.
 * Persists to .code-intel/auto-approve.json.
 */
export declare const MANAGE_AUTO_APPROVE_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            tool_name: {
                type: string;
                description: string;
            };
            server_name: {
                type: string;
                description: string;
            };
            auto_approve: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function executeManageAutoApprove(args: Record<string, any>, workspace: string): string;
//# sourceMappingURL=manage-auto-approve.d.ts.map