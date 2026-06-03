"use strict";
/**
 * sf_parse_lwc tool — Parse Lightning Web Component.
 * Implements UC-4, BR-13 through BR-17.
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
exports.parseLwcSchema = void 0;
exports.handleParseLwc = handleParseLwc;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const errors_js_1 = require("../../../shared/errors.js");
exports.parseLwcSchema = zod_1.z.object({
    file_path: zod_1.z.string().min(1, 'file_path is required'),
});
async function handleParseLwc(args, workspace) {
    const parsed = exports.parseLwcSchema.safeParse(args);
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
    let componentDir;
    if (stat.isDirectory()) {
        componentDir = resolved;
    }
    else {
        componentDir = path.dirname(resolved);
    }
    const componentName = path.basename(componentDir);
    const result = parseLwcComponent(componentDir, componentName, file_path);
    return JSON.stringify(result);
}
function parseLwcComponent(componentDir, componentName, filePath) {
    const errors = [];
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
function extractImports(jsContent) {
    const imports = [];
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
function extractPublicProperties(jsContent) {
    const properties = [];
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
function extractWireAdapters(jsContent) {
    const adapters = [];
    const wireRegex = /@wire\s*\(\s*(\w+)/g;
    let match;
    while ((match = wireRegex.exec(jsContent)) !== null) {
        adapters.push(match[1]);
    }
    return adapters;
}
function extractApexCalls(imports) {
    const apexCalls = [];
    for (const imp of imports) {
        if (imp.source.startsWith('@salesforce/apex/')) {
            const className = imp.source.replace('@salesforce/apex/', '').split('.')[0];
            apexCalls.push(className);
        }
    }
    return apexCalls;
}
function extractChildComponents(htmlContent) {
    const children = new Set();
    const tagRegex = /<(c-[\w-]+|lightning-[\w-]+)/g;
    let match;
    while ((match = tagRegex.exec(htmlContent)) !== null) {
        children.add(match[1]);
    }
    return [...children];
}
function extractEvents(jsContent, htmlContent) {
    const events = [];
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
function buildLwcDependencies(imports, wireAdapters, apexCalls, childComponents) {
    const customLabels = [];
    for (const imp of imports) {
        if (imp.source.startsWith('@salesforce/label/')) {
            customLabels.push(imp.source.replace('@salesforce/label/', ''));
        }
    }
    return { apex_classes: apexCalls, wire_adapters: wireAdapters, child_components: childComponents, custom_labels: customLabels };
}
//# sourceMappingURL=parse-lwc.js.map