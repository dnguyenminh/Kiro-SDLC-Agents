/**
 * sf_index_file tool — Index a single metadata file into KB.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Errors, SfToolError } from '../../../shared/errors.js';
import { KBClient } from '../../../shared/kb-client.js';
import { handleParseApex } from '../../sf-parser/tools/parse-apex.js';
import { handleParseFlow } from '../../sf-parser/tools/parse-flow.js';
import { handleParseObject } from '../../sf-parser/tools/parse-object.js';
import { handleParseLwc } from '../../sf-parser/tools/parse-lwc.js';
import type { KBPayload } from '../../../shared/types.js';

export const indexFileSchema = z.object({
  file_path: z.string().min(1, 'file_path is required'),
});

export async function handleIndexFile(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = indexFileSchema.safeParse(args);
  if (!parsed.success) return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });

  const { file_path } = parsed.data;
  const resolved = path.resolve(workspace, file_path);
  if (!resolved.startsWith(path.normalize(workspace))) throw new SfToolError('SF-001', `Path traversal detected: ${file_path}`);
  if (!fs.existsSync(resolved)) throw Errors.fileNotFound(file_path);

  const kbClient = new KBClient(workspace);
  let payload: KBPayload | null = null;

  if (file_path.endsWith('.cls') || file_path.endsWith('.trigger')) {
    const data = JSON.parse(await handleParseApex({ file_path }, workspace));
    if (!data.error) payload = { content: `## ${data.name} (${data.type})\n\n**File:** ${data.file_path}\n**Methods:** ${data.methods.length}`, type: 'CONTEXT', tags: `salesforce, ApexClass, ${data.name}`, summary: `${data.name} — ${data.type}` };
  } else if (file_path.endsWith('.flow-meta.xml')) {
    const data = JSON.parse(await handleParseFlow({ file_path }, workspace));
    if (!data.error) payload = { content: `## ${data.name} (Flow)\n\n**File:** ${data.file_path}\n**Type:** ${data.type}`, type: 'CONTEXT', tags: `salesforce, Flow, ${data.name}`, summary: `${data.name} — flow` };
  } else if (file_path.endsWith('.object-meta.xml')) {
    const data = JSON.parse(await handleParseObject({ file_path }, workspace));
    if (!data.error) payload = { content: `## ${data.name} (CustomObject)\n\n**File:** ${data.file_path}\n**Fields:** ${data.fields.length}`, type: 'CONTEXT', tags: `salesforce, CustomObject, ${data.name}`, summary: `${data.name} — object` };
  } else {
    const data = JSON.parse(await handleParseLwc({ file_path }, workspace));
    if (!data.error) payload = { content: `## ${data.name} (LWC)\n\n**File:** ${data.file_path}`, type: 'CONTEXT', tags: `salesforce, LWC, ${data.name}`, summary: `${data.name} — LWC` };
  }

  if (payload) {
    const success = await kbClient.ingest(payload);
    return JSON.stringify({ status: success ? 'success' : 'kb_unavailable', file_path, kb_ingested: success });
  }
  return JSON.stringify({ status: 'skipped', file_path, reason: 'Could not parse file' });
}
