/**
 * sf_parse_apex tool — Parse a single Apex class or trigger file.
 * Implements UC-1, BR-1 through BR-5.
 */
import { z } from 'zod';
export declare const parseApexSchema: z.ZodObject<{
    file_path: z.ZodString;
    include_body: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    file_path: string;
    include_body: boolean;
}, {
    file_path: string;
    include_body?: boolean | undefined;
}>;
export declare function handleParseApex(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=parse-apex.d.ts.map