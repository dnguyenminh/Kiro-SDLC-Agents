/**
 * drawio_auto_layout MCP tool — REVIEW mode: detect issues, report for AI to fix.
 * Does NOT modify the file. Returns detailed issue list.
 */
export declare const DRAWIO_TOOL_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            file_path: {
                type: string;
                description: string;
            };
            algorithm: {
                type: string;
                description: string;
            };
            spacing: {
                type: string;
                description: string;
            };
            direction: {
                type: string;
                description: string;
            };
            export_png: {
                type: string;
                description: string;
            };
            force: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function handleDrawioLayout(args: Record<string, unknown>, workspace: string): string;
//# sourceMappingURL=drawio-tool.d.ts.map