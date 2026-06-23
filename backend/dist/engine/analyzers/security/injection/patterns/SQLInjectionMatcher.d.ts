/**
 * KSA-165: SQL Injection Matcher — 4 patterns for SQL injection detection.
 */
import { PatternMatcher } from '../PatternMatcher.js';
import type { InjectionPattern } from '../../types.js';
export declare class SQLInjectionMatcher extends PatternMatcher {
    readonly category = "sql_injection";
    readonly patterns: InjectionPattern[];
}
