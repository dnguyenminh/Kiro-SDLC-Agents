/**
 * sf_scan_project tool — Scan SFDX project structure and list all components.
 * Implements UC-5, BR-18 through BR-20.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Errors, SfToolError } from '../../../shared/errors.js';
import { SfdxDetector } from '../../../shared/sfdx-detector.js';
import type { ProjectScanResult, ProjectComponent, MetadataType } from '../../../shared/types.js';

export const scanProjectSchema = z.object({
  project_path: z.string().min(1, 'project_path is required'),
});

export async function handleScanProject(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = scanProjectSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
  }

  const { project_path } = parsed.data;
  const resolved = path.resolve(workspace, project_path);

  if (!resolved.startsWith(path.normalize(workspace))) {
    throw new SfToolError('SF-001', `Path traversal detected: ${project_path}`);
  }

  const detector = new SfdxDetector();
  const project = detector.detect(resolved);
  if (!project) {
    throw Errors.notSfdxProject(project_path);
  }

  const components = scanComponents(project.root, project.packageDirectories);

  const summary = {
    apex_classes: 0, apex_triggers: 0, flows: 0,
    objects: 0, lwc_components: 0, other: 0, total: components.length,
  };

  for (const comp of components) {
    switch (comp.type) {
      case 'ApexClass': case 'ApexInterface': case 'ApexEnum': summary.apex_classes++; break;
      case 'ApexTrigger': summary.apex_triggers++; break;
      case 'Flow': summary.flows++; break;
      case 'CustomObject': summary.objects++; break;
      case 'LWC': summary.lwc_components++; break;
      default: summary.other++; break;
    }
  }

  const result: ProjectScanResult = {
    project_path: project.root,
    sfdx_config: project.config,
    package_directories: project.packageDirectories,
    components,
    summary,
  };

  return JSON.stringify(result);
}

function scanComponents(projectRoot: string, packageDirs: string[]): ProjectComponent[] {
  const components: ProjectComponent[] = [];
  for (const pkgDir of packageDirs) {
    const pkgPath = path.join(projectRoot, pkgDir);
    if (!fs.existsSync(pkgPath)) continue;
    scanDirectory(pkgPath, 'classes', '.cls', 'ApexClass', components, projectRoot);
    scanDirectory(pkgPath, 'triggers', '.trigger', 'ApexTrigger', components, projectRoot);
    scanDirectory(pkgPath, 'flows', '.flow-meta.xml', 'Flow', components, projectRoot);
    scanObjectsDirectory(pkgPath, components, projectRoot);
    scanLwcDirectory(pkgPath, components, projectRoot);
  }
  return components;
}

function scanDirectory(basePath: string, subDir: string, ext: string, type: MetadataType, components: ProjectComponent[], projectRoot: string): void {
  const searchPaths = findDirectories(basePath, subDir);
  for (const dirPath of searchPaths) {
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith(ext));
    for (const file of files) {
      const name = file.replace(ext, '').replace('-meta.xml', '');
      const filePath = path.relative(projectRoot, path.join(dirPath, file));
      components.push({ name, type, file_path: filePath.replace(/\\/g, '/') });
    }
  }
}

function scanObjectsDirectory(basePath: string, components: ProjectComponent[], projectRoot: string): void {
  const searchPaths = findDirectories(basePath, 'objects');
  for (const dirPath of searchPaths) {
    if (!fs.existsSync(dirPath)) continue;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const filePath = path.relative(projectRoot, path.join(dirPath, entry.name));
        components.push({ name: entry.name, type: 'CustomObject', file_path: filePath.replace(/\\/g, '/') });
      } else if (entry.name.endsWith('.object-meta.xml')) {
        const name = entry.name.replace('.object-meta.xml', '');
        const filePath = path.relative(projectRoot, path.join(dirPath, entry.name));
        components.push({ name, type: 'CustomObject', file_path: filePath.replace(/\\/g, '/') });
      }
    }
  }
}

function scanLwcDirectory(basePath: string, components: ProjectComponent[], projectRoot: string): void {
  const searchPaths = findDirectories(basePath, 'lwc');
  for (const dirPath of searchPaths) {
    if (!fs.existsSync(dirPath)) continue;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('__')) {
        const filePath = path.relative(projectRoot, path.join(dirPath, entry.name));
        components.push({ name: entry.name, type: 'LWC', file_path: filePath.replace(/\\/g, '/') });
      }
    }
  }
}

function findDirectories(basePath: string, targetName: string): string[] {
  const results: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name === targetName) {
            results.push(path.join(dir, entry.name));
          } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(path.join(dir, entry.name), depth + 1);
          }
        }
      }
    } catch { /* skip unreadable */ }
  };
  walk(basePath, 0);
  return results;
}
