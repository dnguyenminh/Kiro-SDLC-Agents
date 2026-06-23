/**
 * sf_kb_search tool — Search KB for indexed Salesforce metadata.
 */
import { z } from 'zod';
export declare const kbSearchSchema: z.ZodObject<{
    query: z.ZodString;
    metadata_type: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit: number;
    metadata_type?: string | undefined;
}, {
    query: string;
    metadata_type?: string | undefined;
    limit?: number | undefined;
}>;
export declare function handleKbSearch(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=kb-search.d.ts.map