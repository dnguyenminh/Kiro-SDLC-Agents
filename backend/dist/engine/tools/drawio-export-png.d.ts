/**
 * drawio_export_png — Export .drawio file to PNG image.
 *
 * Priority order for rendering:
 * 1. draw.io CLI (drawio desktop app) — fastest, most accurate
 * 2. chrome-devtools-mcp (upstream MCP) — uses browser screenshot
 * 3. puppeteer MCP (upstream MCP) — headless browser
 *
 * If none available, tool is NOT published (hidden from tool list).
 *
 * Input: relative path to .drawio file
 * Output: relative path to exported .png file
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
/** Renderer type detected at runtime */
type RendererType = 'drawio-cli' | 'chrome-devtools-mcp' | 'puppeteer-mcp' | 'none';
/**
 * Detect which renderer is available (priority order).
 * Result is cached for the session.
 */
export declare function detectRenderer(orchestrationEngine?: any): RendererType;
/** Check if tool should be published (at least one renderer available) */
export declare function isExportPngAvailable(orchestrationEngine?: any): boolean;
/** Reset cached renderer (for testing or when orchestration changes) */
export declare function resetRendererCache(): void;
/**
 * Handle the drawio_export_png tool call.
 * Returns JSON with relative path to PNG or error.
 */
export declare function handleDrawioExportPng(args: Record<string, unknown>, workspace: string, orchestrationEngine?: any): Promise<string>;
export {};
