/**
 * KSA-165: XSS Matcher — 4 patterns for Cross-Site Scripting detection.
 */
import { PatternMatcher } from '../PatternMatcher.js';
import type { InjectionPattern } from '../../types.js';
export declare class XSSMatcher extends PatternMatcher {
    readonly category = "xss";
    readonly patterns: InjectionPattern[];
}
//# sourceMappingURL=XSSMatcher.d.ts.map