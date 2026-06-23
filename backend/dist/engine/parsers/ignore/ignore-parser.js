/**
 * KSA-169: Ignore Parser — Parse .codeintelignore files (gitignore syntax).
 * Supports glob patterns, negation (!), and directory markers (/).
 */
import * as fs from 'fs';
import * as path from 'path';
export const DEFAULT_IGNORE_PATTERNS = [
    'node_modules/', '.git/', 'build/', 'dist/', 'target/',
    '__pycache__/', '.pytest_cache/', '*.min.js', '*.bundle.js',
    '.gradle/', '.idea/', '.vscode/', '*.pyc', '*.class',
    '*.o', '*.so', '.code-intel/', 'coverage/', '.next/', '.nuxt/',
];
export class IgnoreParser {
    patterns = [];
    constructor() {
        this.addPatterns(DEFAULT_IGNORE_PATTERNS, '<defaults>');
    }
    parseFile(filePath) {
        try {
            if (!fs.existsSync(filePath))
                return;
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#'));
            this.addPatterns(lines, filePath);
        }
        catch (err) {
            console.error(`[ignore-parser] Failed to parse ${filePath}:`, err);
        }
    }
    shouldIgnore(filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        let ignored = false;
        for (const pattern of this.patterns) {
            if (pattern.regex.test(normalizedPath)) {
                ignored = !pattern.isNegation;
            }
        }
        return ignored;
    }
    getPatterns() {
        return [...this.patterns];
    }
    addPatterns(patterns, sourceFile) {
        for (const raw of patterns) {
            const parsed = this.parsePattern(raw, sourceFile);
            if (parsed)
                this.patterns.push(parsed);
        }
    }
    parsePattern(raw, sourceFile) {
        let pattern = raw.trim();
        if (!pattern || pattern.startsWith('#'))
            return null;
        const isNegation = pattern.startsWith('!');
        if (isNegation)
            pattern = pattern.slice(1);
        const isDirectory = pattern.endsWith('/');
        if (isDirectory)
            pattern = pattern.slice(0, -1);
        const regex = this.globToRegex(pattern, isDirectory);
        return { pattern: raw, regex, isNegation, isDirectory, sourceFile };
    }
    globToRegex(pattern, isDirectory) {
        let regexStr = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\{\{GLOBSTAR\}\}/g, '.*');
        if (!pattern.startsWith('/')) {
            regexStr = `(^|/)${regexStr}`;
        }
        else {
            regexStr = `^${regexStr.slice(2)}`;
        }
        if (isDirectory) {
            regexStr = `${regexStr}(/|$)`;
        }
        else {
            regexStr = `${regexStr}($|/)`;
        }
        return new RegExp(regexStr);
    }
}
export function createIgnoreParser(workspace) {
    const parser = new IgnoreParser();
    parser.parseFile(path.join(workspace, '.codeintelignore'));
    const gitignore = path.join(workspace, '.gitignore');
    if (fs.existsSync(gitignore)) {
        parser.parseFile(gitignore);
    }
    return parser;
}
//# sourceMappingURL=ignore-parser.js.map