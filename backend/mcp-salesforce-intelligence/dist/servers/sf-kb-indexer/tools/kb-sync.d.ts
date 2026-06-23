/**
 * sf_kb_sync tool — Sync index state, detect changes, and re-index only modified files.
 */
import { z } from 'zod';
export declare const kbSyncSchema: z.ZodObject<{
    project_path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    project_path: string;
}, {
    project_path: string;
}>;
export declare function handleKbSync(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=kb-sync.d.ts.map