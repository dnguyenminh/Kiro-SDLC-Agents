/**
 * sf_parse_lwc tool — Parse Lightning Web Component.
 * Implements UC-4, BR-13 through BR-17.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Errors, SfToolError } from '../../../shared/errors.js';
import type { LWCParseResult, LWCImport, LWCProperty, LWCEvent, LWCDependencies, ParseError } from '../../../shared/types.js';

export const parseLwcSchema = z.object({
  file_path: z.string().min(1, 'file_path is required'),
});

export async function handleParseLwc(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = parseLwcSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
  }

  const { file_path } = parsed.data;
  const resolved = path.resolve(workspace, file_path);

  if (!resolved.startsWith(path.normalize(workspace))) {
    throw new SfToolError('SF-001', `Path traversal detected: ${file_path}`);
  }

  if (!fs.existsSync(resolved)) {
    throw Errors.fileNotFound(file_path);
  }

  const stat = fs.statSync(resolved);
  let componentDir: string;
  if (stat.isDirectory()) {
    componentDir = resolved;
  } else {
    componentDir = path.dirname(resolved);
  }

  const componentName = path.basename(componentDir);
  const result = parseLwcComponent(componentDir, componentName, file_path);
  return JSON.stringify(result);
}

function parseLwcComponent(componentDir: string, componentName: string, filePath: string): LWCParseResult {
  const errors: ParseError[] = [];
  const files = fs.existsSync(componentDir) ? fs.readdirSync(componentDir) : [];

  const jsFile = files.find(f => f.endsWith('.js') && !f.endsWith('.test.js')) ?? null;
  const htmlFile = files.find(f => f.endsWith('.html')) ?? null;
  const cssFile = files.find(f => f.endsWith('.css')) ?? null;

  let jsContent = '';
  let htmlContent = '';

  if (jsFile) {
    jsContent = fs.readFileSync(path.join(componentDir, jsFile), 'utf-8');
  }
  if (htmlFile) {
    htmlContent = fs.readFileSync(path.join(componentDir, htmlFile), 'utf-8');
  }

  const imports = extractImports(jsContent);
  const publicProperties = extractPublicProperties(jsContent);
  const wireAdapters = extractWireAdapters(jsContent);
  const apexCalls = extractApexCalls(imports);
  const childComponents = extractChildComponents(htmlContent);
  const events = extractEvents(jsContent, htmlContent);
  const dependencies = buildLwcDependencies(imports, wireAdapters, apexCalls, childComponents);

  return {
    file_path: filePath,
    name: componentName,
    js_file: jsFile,
    html_file: htmlFile,
    css_file: cssFile,
    imports,
    public_properties: publicProperties,
    wire_adapters: wireAdapters,
    apex_calls: apexCalls,
    child_components: childComponents,
    events,
    dependencies,
    errors,
  };
}

function extractImports(jsContent: string): LWCImport[] {
  const imports: LWCImport[] = [];
  const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(jsContent)) !== null) {
    const specifiers = match[1]
      ? match[1].split(',').map(s => s.trim()).filter(Boolean)
      : [match[2]];
    imports.push({ source: match[3], specifiers });
  }
  return imports;
}

function extractPublicProperties(jsContent: string): LWCProperty[] {
  const properties: LWCProperty[] = [];
  const apiRegex = /@api\s+(\w+)/g;
  let match;
  while ((match = apiRegex.exec(jsContent)) !== null) {
    properties.push({ name: match[1], type: 'any', decorator: '@api' });
  }
  const trackRegex = /@track\s+(\w+)/g;
  while ((match = trackRegex.exec(jsContent)) !== null) {
    properties.push({ name: match[1], type: 'any', decorator: '@track' });
  }
  return properties;
}

function extractWireAdapters(jsContent: string): string[] {
  const adapters: string[] = [];
  const wireRegex = /@wire\s*\(\s*(\w+)/g;
  let match;
  while ((match = wireRegex.exec(jsContent)) !== null) {
    adapters.push(match[1]);
  }
  return adapters;
}

function extractApexCalls(imports: LWCImport[]): string[] {
  const apexCalls: string[] = [];
  for (const imp of imports) {
    if (imp.source.startsWith('@salesforce/apex/')) {
      const className = imp.source.replace('@salesforce/apex/', '').split('.')[0];
      apexCalls.push(className);
    }
  }
  return apexCalls;
}

function extractChildComponents(htmlContent: string): string[] {
  const children = new Set<string>();
  const tagRegex = /<(c-[\w-]+|lightning-[\w-]+)/g;
  let match;
  while ((match = tagRegex.exec(htmlContent)) !== null) {
    children.add(match[1]);
  }
  return [...children];
}

function extractEvents(jsContent: string, htmlContent: string): LWCEvent[] {
  const events: LWCEvent[] = [];
  const dispatchRegex = /this\.dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"](\w+)['"]/g;
  let match;
  while ((match = dispatchRegex.exec(jsContent)) !== null) {
    events.push({ name: match[1], type: 'dispatch' });
  }
  const handleRegex = /on(\w+)\s*=\s*\{/g;
  while ((match = handleRegex.exec(htmlContent)) !== null) {
    events.push({ name: match[1], type: 'handle' });
  }
  return events;
}

function buildLwcDependencies(imports: LWCImport[], wireAdapters: string[], apexCalls: string[], childComponents: string[]): LWCDependencies {
  const customLabels: string[] = [];
  for (const imp of imports) {
    if (imp.source.startsWith('@salesforce/label/')) {
      customLabels.push(imp.source.replace('@salesforce/label/', ''));
    }
  }
  return { apex_classes: apexCalls, wire_adapters: wireAdapters, child_components: childComponents, custom_labels: customLabels };
}
