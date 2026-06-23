/**
 * HTTP ingest-file route — POST /api/memory/ingest-file.
 * Allows extension to directly index documents without going through MCP stdio.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryEngine } from '../memory/memory-engine.js';

interface IngestFileRequest {
  file_path: string;
  type?: string;
  format?: string;
}

interface IngestFileResult {
  file_path: string;
  entries_created: number;
  skipped: boolean;
  reason?: string;
}

/** Handle POST /api/memory/ingest-file. */
export function handleIngestFileRoute(
  req: http.IncomingMessage,
  url: URL,
  res: http.ServerResponse,
  engine: MemoryEngine | null,
  workspace: string
): void {
  if (url.pathname !== '/api/memory/ingest-file') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }
  if (!engine) {
    sendJson(res, 503, { error: 'Memory not initialized' });
    return;
  }

  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const files: IngestFileRequest[] = parsed.files || [parsed];
      const results = files.map(f => ingestFile(f, engine, workspace));
      const ingested = results.filter(r => !r.skipped).length;
      const skipped = results.filter(r => r.skipped).length;
      sendJson(res, 200, { total: results.length, ingested, skipped, results });
    } catch (err: any) {
      sendJson(res, 400, { error: `Invalid JSON: ${err.message}` });
    }
  });
}

function ingestFile(req: IngestFileRequest, engine: MemoryEngine, workspace: string): IngestFileResult {
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
    if (section.content.trim().length === 0) continue;
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

function splitMarkdownSections(text: string): Array<{ heading: string; content: string }> {
  const lines = text.split('\n');
  const sections: Array<{ heading: string; content: string }> = [];
  let heading = '';
  let buf: string[] = [];

  for (const line of lines) {
    if (line.startsWith('#')) {
      if (buf.length > 0) sections.push({ heading, content: buf.join('\n') });
      heading = line.replace(/^#+\s*/, '');
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) sections.push({ heading, content: buf.join('\n') });
  return sections;
}

function typeToTier(type: string): string {
  switch (type) {
    case 'REQUIREMENT': case 'ARCHITECTURE': case 'PROCEDURE':
      return 'SEMANTIC';
    case 'DECISION': case 'LESSON_LEARNED':
      return 'EPISODIC';
    default:
      return 'WORKING';
  }
}

function resolvePath(filePath: string, workspace: string): string | null {
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) return filePath;
  if (workspace) {
    const wsPath = path.join(workspace, filePath);
    if (fs.existsSync(wsPath)) return wsPath;
  }
  return null;
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}
