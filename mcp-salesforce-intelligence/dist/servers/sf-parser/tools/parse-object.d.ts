/**
 * sf_parse_object tool — Parse CustomObject metadata.
 * Implements UC-3, BR-10 through BR-12.
 */
import { z } from 'zod';
export declare const parseObjectSchema: z.ZodObject<{
    file_path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    file_path: string;
}, {
    file_path: string;
}>;
export declare function handleParseObject(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=parse-object.d.ts.map