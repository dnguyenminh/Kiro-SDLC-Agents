/**
 * drawio_export_png — Export .drawio file to PNG image.
 */
export declare const DRAWIO_EXPORT_PNG_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            file_path: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
type RendererType = 'drawio-cli' | 'chrome-devtools-mcp' | 'puppeteer-mcp' | 'none';
export declare function detectRenderer(orchestrationEngine?: any): RendererType;
export declare function isExportPngAvailable(orchestrationEngine?: any): boolean;
export declare function resetRendererCache(): void;
export declare function handleDrawioExportPng(args: Record<string, unknown>, workspace: string, orchestrationEngine?: any): Promise<string>;
export {};
//# sourceMappingURL=drawio-export-png.d.ts.map
