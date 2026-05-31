"use strict";
/**
 * KSA-165: Deserialization Matcher — 3 patterns for unsafe deserialization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeserializationMatcher = void 0;
const PatternMatcher_js_1 = require("../PatternMatcher.js");
class DeserializationMatcher extends PatternMatcher_js_1.PatternMatcher {
    category = 'deserialization';
    patterns = [
        {
            id: 16,
            name: 'Unsafe YAML Load with User Input',
            category: 'deserialization',
            cwe: 'CWE-502',
            severity: 'Critical',
            sinkPatterns: ['yaml.load(', 'yaml.unsafe_load(', 'YAML.load('],
            dangerousOps: ['pass_through', 'assign', 'function_call'],
            safePatterns: ['yaml.safe_load', 'yaml.SafeLoader', 'Loader=SafeLoader'],
            description: 'Use yaml.safe_load() or yaml.load(data, Loader=SafeLoader) instead of yaml.load().',
        },
        {
            id: 17,
            name: 'Pickle/Marshal Deserialization of User Data',
            category: 'deserialization',
            cwe: 'CWE-502',
            severity: 'Critical',
            sinkPatterns: ['pickle.loads(', 'pickle.load(', 'marshal.loads(', 'unserialize('],
            dangerousOps: ['pass_through', 'assign', 'function_call'],
            safePatterns: ['hmac', 'signature', 'verify'],
            description: 'Never deserialize untrusted data with pickle/marshal. Use JSON or implement HMAC signature verification.',
        },
        {
            id: 18,
            name: 'XML External Entity (XXE) Processing',
            category: 'deserialization',
            cwe: 'CWE-611',
            severity: 'High',
            sinkPatterns: ['parseXML(', 'DOMParser', 'xml2js.parse', 'etree.fromstring', 'etree.parse'],
            dangerousOps: ['pass_through', 'assign', 'function_call'],
            safePatterns: ['resolve_entities=False', 'disallow_doctype', 'defusedxml', 'noent: false'],
            description: 'Disable external entity resolution: use defusedxml (Python) or set parser options to disallow DTD/entities.',
        },
    ];
}
exports.DeserializationMatcher = DeserializationMatcher;
//# sourceMappingURL=DeserializationMatcher.js.map