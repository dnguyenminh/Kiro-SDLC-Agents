"use strict";
/**
 * sf_parse_flow tool — Parse a Flow metadata XML file.
 * Implements UC-2, BR-6 through BR-9.
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
exports.parseFlowSchema = void 0;
exports.handleParseFlow = handleParseFlow;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const errors_js_1 = require("../../../shared/errors.js");
exports.parseFlowSchema = zod_1.z.object({
    file_path: zod_1.z.string().min(1, 'file_path is required'),
});
async function handleParseFlow(args, workspace) {
    const parsed = exports.parseFlowSchema.safeParse(args);
    if (!parsed.success) {
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    }
    const { file_path } = parsed.data;
    const resolved = path.resolve(workspace, file_path);
    if (!resolved.startsWith(path.normalize(workspace))) {
        throw new errors_js_1.SfToolError('SF-001', `Path traversal detected: ${file_path}`);
    }
    if (!fs.existsSync(resolved)) {
        throw errors_js_1.Errors.fileNotFound(file_path);
    }
    if (!file_path.endsWith('.flow-meta.xml') && !file_path.endsWith('.flow')) {
        throw errors_js_1.Errors.unsupportedType(path.extname(file_path));
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    const result = parseFlowContent(content, file_path);
    return JSON.stringify(result);
}
function parseFlowContent(content, filePath) {
    const errors = [];
    const elements = [];
    const variables = [];
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
function extractFlowDependencies(content) {
    const referencedObjects = new Set();
    const referencedClasses = new Set();
    const referencedFlows = new Set();
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
//# sourceMappingURL=parse-flow.js.map