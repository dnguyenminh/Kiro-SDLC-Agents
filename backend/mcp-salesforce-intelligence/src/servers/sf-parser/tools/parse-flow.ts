/**
 * sf_parse_flow tool — Parse a Flow metadata XML file.
 * Implements UC-2, BR-6 through BR-9.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Errors, SfToolError } from '../../../shared/errors.js';
import type { FlowParseResult, FlowElement, FlowVariable, FlowDependencies, ParseError } from '../../../shared/types.js';

export const parseFlowSchema = z.object({
  file_path: z.string().min(1, 'file_path is required'),
});

export async function handleParseFlow(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = parseFlowSchema.safeParse(args);
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

  if (!file_path.endsWith('.flow-meta.xml') && !file_path.endsWith('.flow')) {
    throw Errors.unsupportedType(path.extname(file_path));
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  const result = parseFlowContent(content, file_path);
  return JSON.stringify(result);
}

function parseFlowContent(content: string, filePath: string): FlowParseResult {
  const errors: ParseError[] = [];
  const elements: FlowElement[] = [];
  const variables: FlowVariable[] = [];

  const name = path.basename(filePath).replace('.flow-meta.xml', '').replace('.flow', '');

  const typeMatch = content.match(/<processType>(\w+)<\/processType>/);
  const type = typeMatch ? typeMatch[1] : 'AutoLaunchedFlow';

  const statusMatch = content.match(/<status>(\w+)<\/status>/);
  const status = statusMatch ? statusMatch[1] : 'Draft';

  const elementTypes = [
    'decisions', 'assignments', 'recordCreates', 'recordUpdates',
    'recordDeletes', 'recordLookups', 'screens', 'subflows',
    'actionCalls', 'loops', 'waits',
  ];

  for (const elemType of elementTypes) {
    const regex = new RegExp(`<${elemType}>([\\s\\S]*?)<\\/${elemType}>`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const nameMatch = match[1].match(/<name>([^<]+)<\/name>/);
      const labelMatch = match[1].match(/<label>([^<]+)<\/label>/);
      const connectorMatch = match[1].match(/<connector>[\s\S]*?<targetReference>([^<]+)<\/targetReference>/);
      elements.push({
        name: nameMatch?.[1] ?? 'unknown',
        type: elemType,
        label: labelMatch?.[1] ?? nameMatch?.[1] ?? '',
        connector: connectorMatch?.[1],
      });
    }
  }

  const varRegex = /<variables>([\s\S]*?)<\/variables>/g;
  let varMatch;
  while ((varMatch = varRegex.exec(content)) !== null) {
    const vName = varMatch[1].match(/<name>([^<]+)<\/name>/)?.[1] ?? '';
    const vType = varMatch[1].match(/<dataType>([^<]+)<\/dataType>/)?.[1] ?? 'Text';
    const isInput = /<isInput>true<\/isInput>/.test(varMatch[1]);
    const isOutput = /<isOutput>true<\/isOutput>/.test(varMatch[1]);
    variables.push({ name: vName, type: vType, is_input: isInput, is_output: isOutput });
  }

  const dependencies = extractFlowDependencies(content);

  return { file_path: filePath, name, type, status, elements, variables, dependencies, errors };
}

function extractFlowDependencies(content: string): FlowDependencies {
  const referencedObjects = new Set<string>();
  const referencedClasses = new Set<string>();
  const referencedFlows = new Set<string>();

  const objRegex = /<object>([^<]+)<\/object>/g;
  let match;
  while ((match = objRegex.exec(content)) !== null) {
    referencedObjects.add(match[1]);
  }

  const apexRegex = /<actionType>apex<\/actionType>[\s\S]*?<actionName>([^<]+)<\/actionName>/g;
  while ((match = apexRegex.exec(content)) !== null) {
    referencedClasses.add(match[1]);
  }

  const subflowRegex = /<flowName>([^<]+)<\/flowName>/g;
  while ((match = subflowRegex.exec(content)) !== null) {
    referencedFlows.add(match[1]);
  }

  return {
    referenced_objects: [...referencedObjects],
    referenced_classes: [...referencedClasses],
    referenced_flows: [...referencedFlows],
  };
}
