/**
 * sf_parse_object tool — Parse CustomObject metadata.
 * Implements UC-3, BR-10 through BR-12.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Errors, SfToolError } from '../../../shared/errors.js';
import type { ObjectParseResult, ObjectField, ObjectRelationship, ParseError } from '../../../shared/types.js';

export const parseObjectSchema = z.object({
  file_path: z.string().min(1, 'file_path is required'),
});

export async function handleParseObject(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = parseObjectSchema.safeParse(args);
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
  let content: string;
  let objectName: string;

  if (stat.isDirectory()) {
    const objectFile = fs.readdirSync(resolved).find(f => f.endsWith('.object-meta.xml'));
    content = objectFile ? fs.readFileSync(path.join(resolved, objectFile), 'utf-8') : '';
    objectName = path.basename(resolved);
    const fieldsDir = path.join(resolved, 'fields');
    if (fs.existsSync(fieldsDir)) {
      const fieldFiles = fs.readdirSync(fieldsDir).filter(f => f.endsWith('.field-meta.xml'));
      for (const ff of fieldFiles) {
        content += '\n' + fs.readFileSync(path.join(fieldsDir, ff), 'utf-8');
      }
    }
  } else {
    content = fs.readFileSync(resolved, 'utf-8');
    objectName = path.basename(file_path).replace('.object-meta.xml', '');
  }

  const result = parseObjectContent(content, file_path, objectName);
  return JSON.stringify(result);
}

function parseObjectContent(content: string, filePath: string, objectName: string): ObjectParseResult {
  const errors: ParseError[] = [];
  const fields: ObjectField[] = [];
  const relationships: ObjectRelationship[] = [];
  const validationRules: string[] = [];
  const triggers: string[] = [];

  const labelMatch = content.match(/<label>([^<]+)<\/label>/);
  const label = labelMatch ? labelMatch[1] : objectName;

  const fieldRegex = /<fields>([\s\S]*?)<\/fields>/g;
  let match;
  while ((match = fieldRegex.exec(content)) !== null) {
    const fc = match[1];
    const fName = fc.match(/<fullName>([^<]+)<\/fullName>/)?.[1] ?? '';
    const fType = fc.match(/<type>([^<]+)<\/type>/)?.[1] ?? 'Text';
    const fLabel = fc.match(/<label>([^<]+)<\/label>/)?.[1] ?? fName;
    const fRequired = /<required>true<\/required>/.test(fc);
    fields.push({ name: fName, type: fType, label: fLabel, required: fRequired });

    const relatedTo = fc.match(/<referenceTo>([^<]+)<\/referenceTo>/)?.[1];
    if (relatedTo) {
      const relType = fType === 'MasterDetail' ? 'MasterDetail' : fType === 'Hierarchy' ? 'Hierarchical' : 'Lookup';
      relationships.push({ name: fName, type: relType as any, related_to: relatedTo });
    }
  }

  const individualFieldRegex = /<CustomField[^>]*>([\s\S]*?)<\/CustomField>/g;
  while ((match = individualFieldRegex.exec(content)) !== null) {
    const fc = match[1];
    const fName = fc.match(/<fullName>([^<]+)<\/fullName>/)?.[1] ?? '';
    if (fName && !fields.find(f => f.name === fName)) {
      const fType = fc.match(/<type>([^<]+)<\/type>/)?.[1] ?? 'Text';
      const fLabel = fc.match(/<label>([^<]+)<\/label>/)?.[1] ?? fName;
      const fRequired = /<required>true<\/required>/.test(fc);
      fields.push({ name: fName, type: fType, label: fLabel, required: fRequired });
    }
  }

  const vrRegex = /<validationRules>([\s\S]*?)<\/validationRules>/g;
  while ((match = vrRegex.exec(content)) !== null) {
    const vrName = match[1].match(/<fullName>([^<]+)<\/fullName>/)?.[1];
    if (vrName) validationRules.push(vrName);
  }

  return { file_path: filePath, name: objectName, label, fields, relationships, validation_rules: validationRules, triggers, errors };
}
