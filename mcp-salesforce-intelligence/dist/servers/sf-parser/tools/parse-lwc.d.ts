/**
 * sf_parse_lwc tool — Parse Lightning Web Component.
 * Implements UC-4, BR-13 through BR-17.
 */
import { z } from 'zod';
export declare const parseLwcSchema: z.ZodObject<{
    file_path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    file_path: string;
}, {
    file_path: string;
}>;
export declare function handleParseLwc(args: Record<string, unknown>, workspace: string): Promise<string>;
//# sourceMappingURL=parse-lwc.d.ts.map