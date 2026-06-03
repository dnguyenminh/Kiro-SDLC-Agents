"use strict";
/**
 * sf_parse_object tool — Parse CustomObject metadata.
 * Implements UC-3, BR-10 through BR-12.
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
exports.parseObjectSchema = void 0;
exports.handleParseObject = handleParseObject;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const errors_js_1 = require("../../../shared/errors.js");
exports.parseObjectSchema = zod_1.z.object({
    file_path: zod_1.z.string().min(1, 'file_path is required'),
});
async function handleParseObject(args, workspace) {
    const parsed = exports.parseObjectSchema.safeParse(args);
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
    const stat = fs.statSync(resolved);
    let content;
    let objectName;
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
    }
    else {
        content = fs.readFileSync(resolved, 'utf-8');
        objectName = path.basename(file_path).replace('.object-meta.xml', '');
    }
    const result = parseObjectContent(content, file_path, objectName);
    return JSON.stringify(result);
}
function parseObjectContent(content, filePath, objectName) {
    const errors = [];
    const fields = [];
    const relationships = [];
    const validationRules = [];
    const triggers = [];
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
            relationships.push({ name: fName, type: relType, related_to: relatedTo });
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
        if (vrName)
            validationRules.push(vrName);
    }
    return { file_path: filePath, name: objectName, label, fields, relationships, validation_rules: validationRules, triggers, errors };
}
//# sourceMappingURL=parse-object.js.map