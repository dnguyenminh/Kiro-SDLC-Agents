/**
 * stream_write_file tool — writes content directly to local disk.
 * Supports write (overwrite), append, and create modes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
/** Register stream_write_file tool on the MCP server. */
export function registerStreamWriteFile(server, workspace) {
    server.tool('stream_write_file', 'Write content directly to a file on disk. Modes: write (overwrite), append, create (fail if exists).', {
        file_path: z.string().describe('Path to file (absolute or relative to workspace)'),
        content: z.string().optional().describe('Text content to write'),
        mode: z.enum(['write', 'append', 'create']).optional().describe('Write mode (default: write)'),
        encoding: z.string().optional().describe('Encoding (default: utf-8)'),
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