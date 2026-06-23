/**
 * KSA-165: LDAP/XML Matcher — 2 patterns for LDAP and XML injection.
 */
import { PatternMatcher } from '../PatternMatcher.js';
import type { InjectionPattern } from '../../types.js';
export declare class LDAPXMLMatcher extends PatternMatcher {
    readonly category = "ldap_xml_injection";
    readonly patterns: InjectionPattern[];
}
//# sourceMappingURL=LDAPXMLMatcher.d.ts.map