/**
 * sf_scan_project tool — Scan SFDX project structure and list all components.
 * Implements UC-5, BR-18 through BR-20.
 */
import { z } from 'zod';
export declare const scanProjectSchema: z.ZodObject<{
    project_path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    project_path: string;
}, {
    project_path: string;
}>;
export declare function handleScanProject(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=scan-project.d.ts.map