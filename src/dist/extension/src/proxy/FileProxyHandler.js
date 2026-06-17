"use strict";
/**
 * FileProxyHandler — Extension acts as File Gateway for Backend.
 * Implements TDD §5.3 IFileProxyHandler, FSD §3.2.4 File Proxy Protocol.
 *
 * Backend has NO filesystem access. Extension reads/writes files on its behalf.
 * 3 Patterns:
 *   Pattern 1 (File Input): Extension reads file, injects content into args
 *   Pattern 2 (File Output): Backend returns data, Extension writes file
 *   Pattern 3 (Text Only): Forward as-is (no file handling)
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
exports.FileProxyError = exports.FileProxyHandler = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Tool classification (from FSD 3.2.4)
const FILE_INPUT_TOOLS = new Set([
    'mem_ingest_file',
    'drawio_auto_layout',
]);
const FILE_OUTPUT_TOOLS = new Set([
    'stream_write_file',
]);
const FILE_BOTH_TOOLS = new Set([
    'drawio_export_png',
    'export_docx',
]);
// Extension-Local tools — run entirely in Extension, no Backend call
const EXTENSION_LOCAL_TOOLS = new Set([
    'embed_images',
]);
// Binary file extensions
const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.docx', '.xlsx', '.pptx',
    '.zip', '.tar', '.gz', '.7z',
    '.woff', '.woff2', '.ttf', '.otf',
    '.onnx', '.bin', '.dat',
    '.db', '.sqlite',
]);
// Size limit: 10MB (BR-42)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
class FileProxyHandler {
    workspaceRoot;
    outputChannel;
    constructor(outputChannel) {
        const folders = vscode.workspace.workspaceFolders;
        this.workspaceRoot = folders?.[0]?.uri.fsPath ?? process.cwd();
        this.outputChannel = outputChannel;
    }
    /**
     * Detect tool pattern based on tool name classification.
     */
    getToolPattern(toolName) {
        if (EXTENSION_LOCAL_TOOLS.has(toolName))
            return 'extension-local';
        if (FILE_BOTH_TOOLS.has(toolName))
            return 'file-both';
        if (FILE_INPUT_TOOLS.has(toolName))
            return 'file-input';
        if (FILE_OUTPUT_TOOLS.has(toolName))
            return 'file-output';
        return 'text-only';
    }
    /**
     * Pattern 1 and 3 (Both): If tool needs file input, read file and inject content.
     * Returns enriched args with __file_content and __file_encoding.
     * Throws error if file not found or exceeds size limit.
     */
    async enrichWithFileContent(toolName, args) {
        const pattern = this.getToolPattern(toolName);
        if (pattern === 'text-only' || pattern === 'file-output') {
            return args; // No file input needed
        }
        // Tool requires file input — look for file_path in arguments
        const filePath = args.file_path;
        if (!filePath) {
            return args; // No file_path provided, forward as-is
        }
        // Resolve relative to absolute (BR-39, BR-43)
        const absolutePath = this.resolveRelativePath(filePath);
        // Check file exists
        if (!fs.existsSync(absolutePath)) {
            throw new FileProxyError('FILE_NOT_FOUND', 'File not found: ' + filePath);
        }
        // Read file
        const stats = fs.statSync(absolutePath);
        // Validate size (BR-42)
        if (stats.size > MAX_FILE_SIZE) {
            const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
            throw new FileProxyError('FILE_TOO_LARGE', 'File exceeds 10MB limit (' + sizeMB + 'MB): ' + filePath + '. Chunk upload not yet supported.');
        }
        // Determine encoding (BR-40, BR-41)
        const isBinary = this.isBinaryFile(absolutePath);
        const content = fs.readFileSync(absolutePath);
        const encoding = isBinary ? 'base64' : 'utf-8';
        const encodedContent = isBinary
            ? content.toString('base64')
            : content.toString('utf-8');
        this.log('File input: ' + filePath + ' (' + (stats.size / 1024).toFixed(1) + 'KB, ' + encoding + ')');
        // Inject file content into args (keep original file_path for Backend reference)
        return {
            ...args,
            __file_content: encodedContent,
            __file_encoding: encoding,
        };
    }
    /**
     * Pattern 2 and 3 (Both): If response contains __file_output, write file to workspace.
     */
    async handleFileOutput(response) {
        if (!response.__file_output) {
            return; // No file output
        }
        const { path: relativePath, data, encoding } = response.__file_output;
        if (!relativePath || !data) {
            this.log('Warning: __file_output missing path or data');
            return;
        }
        // Resolve relative to absolute (BR-39, BR-43)
        const absolutePath = this.resolveRelativePath(relativePath);
        // Create directories if needed
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Decode and write (BR-40, BR-41)
        const buffer = encoding === 'base64'
            ? Buffer.from(data, 'base64')
            : Buffer.from(data, 'utf-8');
        fs.writeFileSync(absolutePath, buffer);
        this.log('File output: ' + relativePath + ' (' + (buffer.length / 1024).toFixed(1) + 'KB written)');
    }
    /**
     * Resolve relative path from workspace root to absolute path.
     * Prevents path traversal attacks.
     */
    resolveRelativePath(relativePath) {
        const normalized = path.normalize(relativePath);
        const absolute = path.resolve(this.workspaceRoot, normalized);
        // Security: ensure resolved path is within workspace (prevent traversal)
        if (!absolute.startsWith(this.workspaceRoot)) {
            throw new FileProxyError('PATH_TRAVERSAL', 'Path traversal detected: ' + relativePath);
        }
        return absolute;
    }
    /**
     * Detect if file is binary based on extension.
     */
    isBinaryFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return BINARY_EXTENSIONS.has(ext);
    }
    log(message) {
        this.outputChannel.appendLine('[FileProxyHandler] ' + message);
    }
}
exports.FileProxyHandler = FileProxyHandler;
/**
 * Custom error for file proxy operations.
 */
class FileProxyError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'FileProxyError';
    }
}
exports.FileProxyError = FileProxyError;
//# sourceMappingURL=FileProxyHandler.js.map