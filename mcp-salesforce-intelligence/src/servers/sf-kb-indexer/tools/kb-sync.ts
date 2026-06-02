/**
 * sf_kb_sync tool — Sync index state, detect changes, and re-index only modified files.
 */

import * as path from 'path';
import { z } from 'zod';
import { Errors, SfToolError } from '../../../shared/errors.js';
import { SfdxDetector } from '../../../shared/sfdx-detector.js';
import { handleIndexProject } from './index-project.js';

export const kbSyncSchema = z.object({
  project_path: z.string().min(1, 'project_path is required'),
});

export async function handleKbSync(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = kbSyncSchema.safeParse(args);
  if (!parsed.success) return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });

  const { project_path } = parsed.data;
  const resolved = path.resolve(workspace, project_path);
  if (!resolved.startsWith(path.normalize(workspace))) throw new SfToolError('SF-001', `Path traversal detected: ${project_path}`);

  const detector = new SfdxDetector();
  const project = detector.detect(resolved);
  if (!project) throw Errors.notSfdxProject(project_path);

  // Sync = incremental index (force=false)
  return handleIndexProject({ project_path, force: false }, workspace);
}
