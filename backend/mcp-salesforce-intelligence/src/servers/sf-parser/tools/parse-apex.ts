/**
 * sf_parse_apex tool — Parse a single Apex class or trigger file.
 * Implements UC-1, BR-1 through BR-5.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Errors, SfToolError } from '../../../shared/errors.js';
import type { ApexParseResult, ApexMethod, ApexProperty, ApexDependencies, TriggerInfo, ParseError } from '../../../shared/types.js';

export const parseApexSchema = z.object({
  file_path: z.string().min(1, 'file_path is required'),
  include_body: z.boolean().optional().default(false),
});

export async function handleParseApex(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = parseApexSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
  }

  const { file_path, include_body } = parsed.data;
  const resolved = resolveAndValidate(workspace, file_path);

  if (!fs.existsSync(resolved)) {
    throw Errors.fileNotFound(file_path);
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.cls' && ext !== '.trigger') {
    throw Errors.unsupportedType(ext);
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  const result = parseApexContent(content, resolved, file_path, include_body);
  return JSON.stringify(result);
}

function resolveAndValidate(workspace: string, inputPath: string): string {
  const resolved = path.resolve(workspace, inputPath);
  const normalizedWorkspace = path.normalize(workspace);
  if (!resolved.startsWith(normalizedWorkspace)) {
    throw new SfToolError('SF-001', `Path traversal detected: ${inputPath}`);
  }
  return resolved;
}

function parseApexContent(content: string, resolvedPath: string, relativePath: string, includeBody: boolean): ApexParseResult {
  const errors: ParseError[] = [];
  const isTrigger = resolvedPath.endsWith('.trigger');
  let type: 'class' | 'interface' | 'enum' | 'trigger' = 'class';
  if (isTrigger) type = 'trigger';

  const name = extractName(content, resolvedPath);
  const modifiers = extractModifiers(content);
  const parentClass = extractParentClass(content);
  const interfaces = extractInterfaces(content);
  const methods = extractMethods(content, includeBody);
  const properties = extractProperties(content);
  const innerClasses = extractInnerClasses(content);
  const dependencies = extractDependencies(content);
  const triggerInfo = isTrigger ? extractTriggerInfo(content) : null;

  if (!isTrigger) {
    if (/\binterface\b/.test(getDeclarationLine(content))) type = 'interface';
    else if (/\benum\b/.test(getDeclarationLine(content))) type = 'enum';
  }

  return {
    file_path: relativePath,
    type,
    name,
    modifiers,
    parent_class: parentClass,
    interfaces,
    methods,
    properties,
    inner_classes: innerClasses,
    dependencies,
    trigger_info: triggerInfo,
    errors,
  };
}

function getDeclarationLine(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/\b(class|interface|enum|trigger)\b/.test(trimmed) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
      return trimmed;
    }
  }
  return '';
}

function extractName(content: string, filePath: string): string {
  const declMatch = content.match(/\b(?:class|interface|enum|trigger)\s+(\w+)/);
  if (declMatch) return declMatch[1];
  return path.basename(filePath, path.extname(filePath));
}

function extractModifiers(content: string): string[] {
  const declLine = getDeclarationLine(content);
  const modifiers: string[] = [];
  const modifierPatterns = ['public', 'private', 'protected', 'global', 'abstract', 'virtual', 'with sharing', 'without sharing', 'inherited sharing'];
  for (const mod of modifierPatterns) {
    if (declLine.toLowerCase().includes(mod)) {
      modifiers.push(mod);
    }
  }
  return modifiers;
}

function extractParentClass(content: string): string | null {
  const match = content.match(/\bextends\s+(\w+)/);
  return match ? match[1] : null;
}

function extractInterfaces(content: string): string[] {
  const match = content.match(/\bimplements\s+([^{]+)/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
}

function extractMethods(content: string, includeBody: boolean): ApexMethod[] {
  const methods: ApexMethod[] = [];
  const methodRegex = /(?:(?:public|private|protected|global|static|override|virtual|abstract|testMethod)\s+)*(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*\{?/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    const returnType = match[1];
    const name = match[2];
    const paramsStr = match[3];

    if (returnType === 'class' || returnType === 'interface' || returnType === 'enum' || returnType === 'trigger') continue;
    if (name === 'if' || name === 'for' || name === 'while' || name === 'catch') continue;

    const linePrefix = content.substring(Math.max(0, match.index - 200), match.index);
    const modLine = linePrefix.split('\n').pop() ?? '';
    const methodModifiers: string[] = [];
    for (const mod of ['public', 'private', 'protected', 'global', 'static', 'override', 'virtual', 'abstract', 'testMethod']) {
      if (modLine.includes(mod)) methodModifiers.push(mod);
    }

    const parameters = paramsStr.split(',')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        const parts = p.split(/\s+/);
        return { name: parts[parts.length - 1] ?? '', type: parts.slice(0, -1).join(' ') };
      });

    methods.push({ name, modifiers: methodModifiers, return_type: returnType, parameters });
  }

  return methods;
}

function extractProperties(content: string): ApexProperty[] {
  const properties: ApexProperty[] = [];
  const propRegex = /(?:(?:public|private|protected|global|static|final|transient)\s+)+(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;={]/g;
  let match;

  while ((match = propRegex.exec(content)) !== null) {
    const type = match[1];
    const name = match[2];
    if (type === 'void' || type === 'class' || type === 'interface') continue;

    const linePrefix = content.substring(Math.max(0, match.index - 100), match.index);
    const modLine = linePrefix.split('\n').pop() ?? '';
    const modifiers: string[] = [];
    for (const mod of ['public', 'private', 'protected', 'global', 'static', 'final', 'transient']) {
      if (modLine.includes(mod) || match[0].includes(mod)) modifiers.push(mod);
    }

    properties.push({ name, type, modifiers });
  }

  return properties;
}

function extractInnerClasses(content: string): string[] {
  const innerClasses: string[] = [];
  const classMatches = [...content.matchAll(/\bclass\s+(\w+)/g)];
  if (classMatches.length > 1) {
    for (let i = 1; i < classMatches.length; i++) {
      innerClasses.push(classMatches[i][1]);
    }
  }
  return innerClasses;
}

function extractDependencies(content: string): ApexDependencies {
  const referencedClasses = new Set<string>();
  const dmlOperations = new Set<string>();
  const soqlQueries: string[] = [];
  const methodCalls: string[] = [];

  const typeRefs = content.matchAll(/\b([A-Z]\w+)\b/g);
  const builtins = new Set(['String', 'Integer', 'Boolean', 'Decimal', 'Double', 'Long', 'Date', 'Datetime', 'Time', 'Id', 'Blob', 'Object', 'Map', 'List', 'Set', 'System', 'Test', 'Assert', 'Type', 'JSON', 'Math', 'Limits', 'Database', 'Schema', 'UserInfo', 'Trigger', 'ApexPages', 'Messaging', 'Void', 'SObject', 'Exception']);
  for (const m of typeRefs) {
    if (!builtins.has(m[1])) {
      referencedClasses.add(m[1]);
    }
  }

  const dmlRegex = /\b(insert|update|delete|upsert|undelete|merge)\s+(\w+)/g;
  let dmlMatch;
  while ((dmlMatch = dmlRegex.exec(content)) !== null) {
    dmlOperations.add(dmlMatch[2]);
  }

  const soqlRegex = /\[([^\]]*SELECT[^\]]*)\]/gi;
  let soqlMatch;
  while ((soqlMatch = soqlRegex.exec(content)) !== null) {
    soqlQueries.push(soqlMatch[1].trim());
  }

  const callRegex = /\b([A-Z]\w+)\.(\w+)\s*\(/g;
  let callMatch;
  while ((callMatch = callRegex.exec(content)) !== null) {
    if (!builtins.has(callMatch[1])) {
      methodCalls.push(`${callMatch[1]}.${callMatch[2]}`);
    }
  }

  return {
    referenced_classes: [...referencedClasses],
    dml_operations: [...dmlOperations],
    soql_queries: soqlQueries,
    method_calls: [...new Set(methodCalls)],
  };
}

function extractTriggerInfo(content: string): TriggerInfo | null {
  const match = content.match(/\btrigger\s+\w+\s+on\s+(\w+)\s*\(([^)]+)\)/);
  if (!match) return null;
  const object = match[1];
  const events = match[2].split(',').map(e => e.trim().toLowerCase());
  return { object, events };
}
