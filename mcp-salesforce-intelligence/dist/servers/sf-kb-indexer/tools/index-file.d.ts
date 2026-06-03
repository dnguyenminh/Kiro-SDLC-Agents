/**
 * sf_index_file tool — Index a single metadata file into KB.
 */
import { z } from 'zod';
export declare const indexFileSchema: z.ZodObject<{
    file_path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    file_path: string;
}, {
    file_path: string;
}>;
export declare function handleIndexFile(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=index-file.d.ts.map