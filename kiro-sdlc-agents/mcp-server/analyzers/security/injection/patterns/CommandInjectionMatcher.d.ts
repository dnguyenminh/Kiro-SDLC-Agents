/**
 * KSA-165: Command Injection Matcher — 4 patterns for OS command injection.
 */
import { PatternMatcher } from '../PatternMatcher.js';
import type { InjectionPattern } from '../../types.js';
export declare class CommandInjectionMatcher extends PatternMatcher {
    readonly category = "command_injection";
    readonly patterns: InjectionPattern[];
}
//# sourceMappingURL=CommandInjectionMatcher.d.ts.map