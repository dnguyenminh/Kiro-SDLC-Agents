"use strict";
/**
 * File Scanner — Traverses workspace, respects .gitignore, detects language.
 * Produces a list of scannable files with metadata.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanWorkspace = scanWorkspace;
exports.scanSingleFile = scanSingleFile;
exports.detectLanguage = detectLanguage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const index_js_1 = require("../parsers/ignore/index.js");
const EXTENSION_LANGUAGE_MAP = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.kt': 'kotlin', '.kts': 'kotlin',
    '.java': 'java',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.hpp': 'cpp',
    '.cs': 'csharp',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.scala': 'scala',
    '.sql': 'sql',
    '.sh': 'bash',
    '.ps1': 'powershell',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.json': 'json',
    '.toml': 'toml',
};
/** Scan workspace and return list of indexable files. */
function scanWorkspace(config) {
    const results = [];
    const ignoreParser = (0, index_js_1.createIgnoreParser)(config.workspace);
    traverseDirectory(config.workspace, config, ignoreParser, results);
    return results;
}
/** Scan a single file and return metadata. */
function scanSingleFile(filePath, workspace) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(workspace, filePath).replace(/\\/g, '/');
        const language = detectLanguage(filePath);
        if (!language)
            return null;
        return {
            absolutePath: filePath,
            relativePath,
            language,
            contentHash: hashContent(content),
            sizeBytes: Buffer.byteLength(content, 'utf-8'),
            lineCount: content.split('\n').length,
        };
    }
    catch {
        return null;
    }
}
/** Detect language from file extension. */
function detectLanguage(filePath) {
    const ext = getExtension(filePath);
    return EXTENSION_LANGUAGE_MAP[ext] ?? null;
}
function getExtension(filePath) {
    if (filePath.endsWith('.gradle.kts'))
        return '.kts';
    return path.extname(filePath).toLowerCase();
}
function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}
function traverseDirectory(dir, config, ignoreParser, results) {
    const entries = safeReadDir(dir);
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(config.workspace, fullPath).replace(/\\/g, '/');
        if (shouldExclude(relPath, entry.name, config.excludePatterns, ignoreParser))
            continue;
        if (entry.isDirectory()) {
            traverseDirectory(fullPath, config, ignoreParser, results);
        }
        else if (entry.isFile()) {
            const file = processFile(fullPath, relPath, config);
            if (file)
                results.push(file);
        }
    }
}
function processFile(fullPath, relPath, config) {
    const language = detectLanguage(fullPath);
    if (!language)
        return null;
    const ext = getExtension(fullPath);
    if (!config.includeExtensions.includes(ext) && ext !== '.kts')
        return null;
    try {
        const stat = fs.statSync(fullPath);
        if (stat.size > config.maxFileSize)
            return null;
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (isBinary(content))
            return null;
        return {
            absolutePath: fullPath,
            relativePath: relPath,
            language,
            contentHash: hashContent(content),
            sizeBytes: stat.size,
            lineCount: content.split('\n').length,
        };
    }
    catch {
        return null;
    }
}
function shouldExclude(relPath, name, excludes, ignoreParser) {
    if (name.startsWith('.') && name !== '.')
        return true;
    for (const pattern of excludes) {
        if (relPath.includes(pattern) || name === pattern)
            return true;
    }
    return ignoreParser.shouldIgnore(relPath);
}
function isBinary(content) {
    const sample = content.slice(0, 1024);
    const nullCount = (sample.match(/\0/g) || []).length;
    return nullCount > 2;
}
function safeReadDir(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=file-scanner.js.map