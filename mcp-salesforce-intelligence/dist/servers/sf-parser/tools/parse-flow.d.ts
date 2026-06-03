/**
 * sf_parse_flow tool — Parse a Flow metadata XML file.
 * Implements UC-2, BR-6 through BR-9.
 */
import { z } from 'zod';
export declare const parseFlowSchema: z.ZodObject<{
    file_path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    file_path: string;
}, {
    file_path: string;
}>;
export declare function handleParseFlow(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=parse-flow.d.ts.map