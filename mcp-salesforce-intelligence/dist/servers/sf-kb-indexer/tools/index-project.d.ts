/**
 * sf_index_project tool — Full project indexing with KB ingestion and graph building.
 */
import { z } from 'zod';
export declare const indexProjectSchema: z.ZodObject<{
    project_path: z.ZodString;
    force: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    project_path: string;
    force: boolean;
}, {
    project_path: string;
    force?: boolean | undefined;
}>;
export declare function handleIndexProject(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=index-project.d.ts.map