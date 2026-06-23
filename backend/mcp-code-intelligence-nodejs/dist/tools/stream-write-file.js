"use strict";
/**
 * stream_write_file tool — writes content directly to local disk.
 * Supports write (overwrite), append, and create modes.
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
exports.registerStreamWriteFile = registerStreamWriteFile;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const zod_1 = require("zod");
/** Register stream_write_file tool on the MCP server. */
function registerStreamWriteFile(server, workspace) {
    server.tool('stream_write_file', 'Write content directly to a file on disk. Modes: write (overwrite), append, create (fail if exists).', {
        file_path: zod_1.z.string().describe('Path to file (absolute or relative to workspace)'),
        content: zod_1.z.string().optional().describe('Text content to write'),
        mode: zod_1.z.enum(['write', 'append', 'create']).optional().describe('Write mode (default: write)'),
        encoding: zod_1.z.string().optional().describe('Encoding (default: utf-8)'),
    }, async (args) => {
        const result = executeStreamWrite(args, workspace);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
}
function executeStreamWrite(args, workspace) {
    const rawPath = args.file_path;
    const mode = args.mode ?? 'write';
    const content = args.content ?? '';
    const encoding = args.encoding ?? 'utf-8';
    const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(workspace, rawPath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    const fileExists = fs.existsSync(filePath);
    const sizeBefore = fileExists ? fs.statSync(filePath).size : 0;
    if (fileExists && content === '') {
        return { file_path: filePath, bytes_written: 0, total_size: sizeBefore, file_size_before: sizeBefore, mode: 'no-op', message: 'File exists, no content provided' };
    }
    if (mode === 'create' && fileExists) {
        return { file_path: filePath, bytes_written: 0, total_size: sizeBefore, file_size_before: sizeBefore, mode: 'error', message: 'File already exists' };
    }
    if (mode === 'append' && fileExists) {
        fs.appendFileSync(filePath, content, { encoding });
    }
    else {
        fs.writeFileSync(filePath, content, { encoding });
    }
    const totalSize = fs.statSync(filePath).size;
    return { file_path: filePath, bytes_written: totalSize - sizeBefore, total_size: totalSize, file_size_before: sizeBefore, mode };
}
//# sourceMappingURL=stream-write-file.js.map