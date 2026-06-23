/**
 * KSA-165: Path Traversal Matcher — 3 patterns for path traversal detection.
 */
import { PatternMatcher } from '../PatternMatcher.js';
import type { InjectionPattern } from '../../types.js';
export declare class PathTraversalMatcher extends PatternMatcher {
    readonly category = "path_traversal";
    readonly patterns: InjectionPattern[];
}
