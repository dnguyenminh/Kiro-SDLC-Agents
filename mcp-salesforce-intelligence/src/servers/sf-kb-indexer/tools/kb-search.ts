/**
 * sf_kb_search tool — Search KB for indexed Salesforce metadata.
 */

import { z } from 'zod';
import { KBClient } from '../../../shared/kb-client.js';

export const kbSearchSchema = z.object({
  query: z.string().min(1, 'query is required'),
  metadata_type: z.string().optional(),
  limit: z.number().optional().default(10),
});

export async function handleKbSearch(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = kbSearchSchema.safeParse(args);
  if (!parsed.success) return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });

  const { query, metadata_type, limit } = parsed.data;
  const cappedLimit = Math.min(limit, 50);
  const kbClient = new KBClient(workspace);
  const results = await kbClient.search(query, metadata_type, cappedLimit);

  return JSON.stringify({ query, metadata_type: metadata_type ?? null, results, total: results.length });
}
