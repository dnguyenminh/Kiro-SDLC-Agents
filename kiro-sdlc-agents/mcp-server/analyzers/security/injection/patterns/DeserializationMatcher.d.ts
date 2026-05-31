/**
 * KSA-165: Deserialization Matcher — 3 patterns for unsafe deserialization.
 */
import { PatternMatcher } from '../PatternMatcher.js';
import type { InjectionPattern } from '../../types.js';
export declare class DeserializationMatcher extends PatternMatcher {
    readonly category = "deserialization";
    readonly patterns: InjectionPattern[];
}
//# sourceMappingURL=DeserializationMatcher.d.ts.map