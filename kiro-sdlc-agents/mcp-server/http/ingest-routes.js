"use strict";
/**
 * HTTP ingest-file route — POST /api/memory/ingest-file.
 * Allows extension to directly index documents without going through MCP stdio.
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
exports.handleIngestFileRoute = handleIngestFileRoute;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** Handle POST /api/memory/ingest-file. */
function handleIngestFileRoute(req, url, res, engine, workspace) {
    if (url.pathname !== '/api/memory/ingest-file') {
        sendJson(res, 404, { error: 'Not found' });
        return;
    }
    if (!engine) {
        sendJson(res, 503, { error: 'Memory not initialized' });
        return;
    }
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            const files = parsed.files || [parsed];
            const results = files.map(f => ingestFile(f, engine, workspace));
            const ingested = results.filter(r => !r.skipped).length;
            const skipped = results.filter(r => r.skipped).length;
            sendJson(res, 200, { total: results.length, ingested, skipped, results });
        }
        catch (err) {
            sendJson(res, 400, { error: `Invalid JSON: ${err.message}` });
        }
    });
}
function ingestFile(req, engine, workspace) {
    const filePath = resolvePath(req.file_path, workspace);
    if (!filePath) {
        return { file_path: req.file_path, entries_created: 0, skipped: true, reason: 'file not found' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const type = req.type || 'CONTEXT';
    const tier = typeToTier(type);
    // Simple markdown section splitting + insert
    const sections = splitMarkdownSections(content);
    let created = 0;
    for (const section of sections) {
        if (section.content.trim().length === 0)
            continue;
        const summary = section.heading
            ? `${section.heading}: ${section.content.substring(0, 100)}`
            : section.content.substring(0, 120);
        engine.knowledge.insert({
            content: section.content,
            summary,
            type,
            tier,
            source: req.file_path,
            tags: section.heading || ''
        });
        created++;
    }
    return { file_path: req.file_path, entries_created: created, skipped: false };
}
function splitMarkdownSections(text) {
    const lines = text.split('\n');
    const sections = [];
    let heading = '';
    let buf = [];
    for (const line of lines) {
        if (line.startsWith('#')) {
            if (buf.length > 0)
                sections.push({ heading, content: buf.join('\n') });
            heading = line.replace(/^#+\s*/, '');
            buf = [];
        }
        else {
            buf.push(line);
        }
    }
    if (buf.length > 0)
        sections.push({ heading, content: buf.join('\n') });
    return sections;
}
function typeToTier(type) {
    switch (type) {
        case 'REQUIREMENT':
        case 'ARCHITECTURE':
        case 'PROCEDURE':
            return 'SEMANTIC';
        case 'DECISION':
        case 'LESSON_LEARNED':
            return 'EPISODIC';
        default:
            return 'WORKING';
    }
}
function resolvePath(filePath, workspace) {
    if (path.isAbsolute(filePath) && fs.existsSync(filePath))
        return filePath;
    if (workspace) {
        const wsPath = path.join(workspace, filePath);
        if (fs.existsSync(wsPath))
            return wsPath;
    }
    return null;
}
function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
}
//# sourceMappingURL=ingest-routes.js.map