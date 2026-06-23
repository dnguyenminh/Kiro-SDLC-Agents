"use strict";
/**
 * KSA-191: Salesforce Metadata Parser Unit Tests.
 * Tests XML-based symbol and relationship extraction for Flows, Objects, Fields.
 * No WASM grammar needed — this parser uses regex-based XML extraction.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const salesforce_meta_parser_js_1 = __importDefault(require("../salesforce-meta-parser.js"));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/salesforce-meta');
let parser;
function setup() {
    // SalesforceMetaParser receives null as parser (no tree-sitter)
    parser = new salesforce_meta_parser_js_1.default(null, 'salesforce-meta');
}
function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}
setup();
(0, node_test_1.describe)('SalesforceMetaParser', () => {
    (0, node_test_1.describe)('getSupportedExtensions', () => {
        (0, node_test_1.it)('should return all SF metadata extensions', () => {
            const exts = parser.getSupportedExtensions();
            strict_1.default.ok(exts.includes('.flow-meta.xml'));
            strict_1.default.ok(exts.includes('.object-meta.xml'));
            strict_1.default.ok(exts.includes('.field-meta.xml'));
            strict_1.default.ok(exts.includes('.js-meta.xml'));
            strict_1.default.ok(exts.includes('.component-meta.xml'));
        });
    });
    (0, node_test_1.describe)('constructor with null parser', () => {
        (0, node_test_1.it)('should not crash when parser is null', () => {
            const p = new salesforce_meta_parser_js_1.default(null, 'salesforce-meta');
            strict_1.default.equal(p.languageId, 'salesforce-meta');
        });
    });
    (0, node_test_1.describe)('parse — SimpleFlow.flow-meta.xml', () => {
        (0, node_test_1.it)('should extract flow as class symbol', () => {
            const source = readFixture('SimpleFlow.flow-meta.xml');
            const result = parser.parse(source, 'force-app/main/default/flows/SimpleFlow.flow-meta.xml');
            const flow = result.symbols.find(s => s.kind === 'class');
            strict_1.default.ok(flow, 'Should find flow symbol');
            strict_1.default.equal(flow.name, 'SimpleFlow');
            strict_1.default.ok(flow.signature?.includes('AutoLaunchedFlow'));
            strict_1.default.equal(flow.isExported, true);
        });
        (0, node_test_1.it)('should extract variables as properties', () => {
            const source = readFixture('SimpleFlow.flow-meta.xml');
            const result = parser.parse(source, 'flows/SimpleFlow.flow-meta.xml');
            const vars = result.symbols.filter(s => s.kind === 'property');
            strict_1.default.ok(vars.length >= 2, 'Should find at least 2 variables');
            const recordId = vars.find(v => v.name === 'recordId');
            strict_1.default.ok(recordId, 'Should find recordId variable');
            strict_1.default.equal(recordId.returnType, 'String');
            strict_1.default.equal(recordId.parentName, 'SimpleFlow');
        });
        (0, node_test_1.it)('should extract decisions as methods', () => {
            const source = readFixture('SimpleFlow.flow-meta.xml');
            const result = parser.parse(source, 'flows/SimpleFlow.flow-meta.xml');
            const decisions = result.symbols.filter(s => s.signature?.includes('Decision'));
            strict_1.default.ok(decisions.length >= 1, 'Should find at least 1 decision');
            strict_1.default.equal(decisions[0].name, 'Check_Account_Type');
        });
        (0, node_test_1.it)('should extract apex actionCalls as calls relationships', () => {
            const source = readFixture('SimpleFlow.flow-meta.xml');
            const result = parser.parse(source, 'flows/SimpleFlow.flow-meta.xml');
            const callsRels = result.relationships.filter(r => r.kind === 'calls');
            strict_1.default.ok(callsRels.length >= 1, 'Should find apex action call');
            strict_1.default.equal(callsRels[0].targetSymbol, 'AccountUpdateAction');
        });
        (0, node_test_1.it)('should extract record operations as uses relationships', () => {
            const source = readFixture('SimpleFlow.flow-meta.xml');
            const result = parser.parse(source, 'flows/SimpleFlow.flow-meta.xml');
            const usesRels = result.relationships.filter(r => r.kind === 'uses');
            strict_1.default.ok(usesRels.length >= 2, 'Should find record operations');
            const accountLookup = usesRels.find(r => r.targetSymbol === 'Account');
            strict_1.default.ok(accountLookup, 'Should find Account lookup');
            const contactUpdate = usesRels.find(r => r.targetSymbol === 'Contact');
            strict_1.default.ok(contactUpdate, 'Should find Contact update');
        });
    });
    (0, node_test_1.describe)('parse — CustomObject.object-meta.xml', () => {
        (0, node_test_1.it)('should extract object as class symbol', () => {
            const source = readFixture('CustomObject.object-meta.xml');
            const result = parser.parse(source, 'objects/MyObject__c/MyObject__c.object-meta.xml');
            const obj = result.symbols.find(s => s.kind === 'class');
            strict_1.default.ok(obj, 'Should find object symbol');
            strict_1.default.equal(obj.name, 'MyObject__c');
            strict_1.default.ok(obj.modifiers?.includes('custom-object'));
        });
        (0, node_test_1.it)('should extract fields as properties', () => {
            const source = readFixture('CustomObject.object-meta.xml');
            const result = parser.parse(source, 'objects/MyObject__c/MyObject__c.object-meta.xml');
            const fields = result.symbols.filter(s => s.kind === 'property');
            strict_1.default.ok(fields.length >= 3, 'Should find at least 3 fields');
            const statusField = fields.find(f => f.name === 'Status__c');
            strict_1.default.ok(statusField, 'Should find Status__c field');
            strict_1.default.equal(statusField.returnType, 'Picklist');
        });
        (0, node_test_1.it)('should extract Lookup/MasterDetail as uses relationships', () => {
            const source = readFixture('CustomObject.object-meta.xml');
            const result = parser.parse(source, 'objects/MyObject__c/MyObject__c.object-meta.xml');
            const usesRels = result.relationships.filter(r => r.kind === 'uses');
            strict_1.default.ok(usesRels.length >= 2, 'Should find lookup relationships');
            const accountRef = usesRels.find(r => r.targetSymbol === 'Account');
            strict_1.default.ok(accountRef, 'Should find Account reference');
            const parentRef = usesRels.find(r => r.targetSymbol === 'ParentObject__c');
            strict_1.default.ok(parentRef, 'Should find ParentObject__c reference');
        });
        (0, node_test_1.it)('should extract validation rules as methods', () => {
            const source = readFixture('CustomObject.object-meta.xml');
            const result = parser.parse(source, 'objects/MyObject__c/MyObject__c.object-meta.xml');
            const rules = result.symbols.filter(s => s.signature?.includes('ValidationRule'));
            strict_1.default.ok(rules.length >= 1, 'Should find validation rule');
            strict_1.default.equal(rules[0].name, 'Status_Required');
        });
    });
    (0, node_test_1.describe)('parse — LookupField.field-meta.xml', () => {
        (0, node_test_1.it)('should extract standalone field', () => {
            const source = readFixture('LookupField.field-meta.xml');
            const result = parser.parse(source, 'force-app/main/default/objects/Case/fields/LookupField.field-meta.xml');
            const field = result.symbols.find(s => s.kind === 'property');
            strict_1.default.ok(field, 'Should find field symbol');
            strict_1.default.equal(field.name, 'LookupField');
            strict_1.default.equal(field.returnType, 'Lookup');
        });
        (0, node_test_1.it)('should infer parent object from path', () => {
            const source = readFixture('LookupField.field-meta.xml');
            const result = parser.parse(source, 'force-app/main/default/objects/Case/fields/LookupField.field-meta.xml');
            const field = result.symbols.find(s => s.kind === 'property');
            strict_1.default.equal(field?.parentName, 'Case');
        });
        (0, node_test_1.it)('should create uses relationship for Lookup field', () => {
            const source = readFixture('LookupField.field-meta.xml');
            const result = parser.parse(source, 'force-app/main/default/objects/Case/fields/LookupField.field-meta.xml');
            const usesRels = result.relationships.filter(r => r.kind === 'uses');
            strict_1.default.ok(usesRels.length >= 1, 'Should find uses relationship');
            strict_1.default.equal(usesRels[0].sourceSymbol, 'Case');
            strict_1.default.equal(usesRels[0].targetSymbol, 'Account');
        });
    });
    (0, node_test_1.describe)('parse — LWCMeta.js-meta.xml', () => {
        (0, node_test_1.it)('should extract LWC component', () => {
            const source = readFixture('LWCMeta.js-meta.xml');
            const result = parser.parse(source, 'force-app/main/default/lwc/LWCMeta/LWCMeta.js-meta.xml');
            const component = result.symbols.find(s => s.kind === 'class');
            strict_1.default.ok(component, 'Should find LWC component');
            strict_1.default.equal(component.name, 'LWCMeta');
            strict_1.default.ok(component.signature?.includes('LWC'));
            strict_1.default.ok(component.modifiers?.includes('exposed'));
            strict_1.default.equal(component.isExported, true);
        });
    });
    (0, node_test_1.describe)('parse — malformed XML', () => {
        (0, node_test_1.it)('should return error without crashing', () => {
            const malformed = '<broken><unclosed>';
            const result = parser.parse(malformed, 'test.flow-meta.xml');
            // Should not crash, may have empty results or errors
            strict_1.default.ok(result, 'Should return a result');
            strict_1.default.ok(Array.isArray(result.symbols));
            strict_1.default.ok(Array.isArray(result.relationships));
            strict_1.default.ok(Array.isArray(result.errors));
        });
    });
    (0, node_test_1.describe)('parse — empty file', () => {
        (0, node_test_1.it)('should handle empty source gracefully', () => {
            const result = parser.parse('', 'empty.flow-meta.xml');
            strict_1.default.ok(result, 'Should return a result');
            strict_1.default.equal(result.errors.length, 0);
        });
    });
});
//# sourceMappingURL=salesforce-meta-parser.test.js.map