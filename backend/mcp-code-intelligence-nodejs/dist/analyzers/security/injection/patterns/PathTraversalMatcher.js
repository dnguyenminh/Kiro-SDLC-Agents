"use strict";
/**
 * KSA-165: Path Traversal Matcher — 3 patterns for path traversal detection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathTraversalMatcher = void 0;
const PatternMatcher_js_1 = require("../PatternMatcher.js");
class PathTraversalMatcher extends PatternMatcher_js_1.PatternMatcher {
    category = 'path_traversal';
    patterns = [
        {
            id: 13,
            name: 'File Read with User-Controlled Path',
            category: 'path_traversal',
            cwe: 'CWE-22',
            severity: 'High',
            sinkPatterns: ['readFile(', 'readFileSync(', 'createReadStream(', 'open(', 'fopen('],
            dangerousOps: ['concat', 'template_literal', 'pass_through'],
            safePatterns: ['path.basename', 'path.normalize', 'startsWith(', 'resolve('],
            description: 'Validate path: const safe = path.resolve(baseDir, userPath); if (!safe.startsWith(baseDir)) throw Error("Invalid path")',
        },
        {
            id: 14,
            name: 'File Write with User-Controlled Path',
            category: 'path_traversal',
            cwe: 'CWE-22',
            severity: 'Critical',
            sinkPatterns: ['writeFile(', 'writeFileSync(', 'createWriteStream(', 'fwrite('],
            dangerousOps: ['concat', 'template_literal', 'pass_through'],
            safePatterns: ['path.basename', 'startsWith(', 'whitelist'],
            description: 'Restrict write paths to a safe directory. Validate resolved path starts with allowed base directory.',
        },
        {
            id: 15,
            name: 'Directory Listing with User Input',
            category: 'path_traversal',
            cwe: 'CWE-22',
            severity: 'Medium',
            sinkPatterns: ['readdir(', 'readdirSync(', 'listdir(', 'scandir('],
            dangerousOps: ['concat', 'template_literal', 'pass_through'],
            safePatterns: ['path.basename', 'startsWith(', 'resolve('],
            description: 'Validate directory path against allowed base directories before listing.',
        },
    ];
}
exports.PathTraversalMatcher = PathTraversalMatcher;
//# sourceMappingURL=PathTraversalMatcher.js.map