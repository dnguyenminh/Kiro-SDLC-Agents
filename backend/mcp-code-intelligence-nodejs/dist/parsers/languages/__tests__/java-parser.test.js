"use strict";
/**
 * KSA-149: Java Parser Unit Tests.
 * Tests symbol extraction, relationship extraction, and edge cases.
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
const web_tree_sitter_1 = require("web-tree-sitter");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const java_parser_js_1 = __importDefault(require("../java-parser.js"));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const GRAMMAR_PATH = path.resolve(__dirname, '../../grammars/tree-sitter-java.wasm');
let parser;
let grammarAvailable = false;
async function setup() {
    await web_tree_sitter_1.Parser.init();
    const tsParser = new web_tree_sitter_1.Parser();
    if (!fs.existsSync(GRAMMAR_PATH)) {
        console.error(`[SKIP] Java WASM grammar not found at ${GRAMMAR_PATH}`);
        return;
    }
    const language = await web_tree_sitter_1.Language.load(GRAMMAR_PATH);
    tsParser.setLanguage(language);
    parser = new java_parser_js_1.default(tsParser, 'java');
    grammarAvailable = true;
}
function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}
(0, node_test_1.describe)('JavaParser', () => {
    (0, node_test_1.before)(async () => {
        await setup();
    });
    (0, node_test_1.describe)('getSupportedExtensions', () => {
        (0, node_test_1.it)('should return .java', () => {
            if (!grammarAvailable)
                return;
            strict_1.default.deepEqual(parser.getSupportedExtensions(), ['.java']);
        });
    });
    (0, node_test_1.describe)('parse — SimpleClass.java', () => {
        (0, node_test_1.it)('should extract package declaration', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const pkg = result.symbols.find(s => s.kind === 'namespace');
            strict_1.default.ok(pkg, 'Should find package declaration');
            strict_1.default.equal(pkg.name, 'com.example.service');
            strict_1.default.ok(pkg.signature?.includes('package'));
        });
        (0, node_test_1.it)('should extract imports', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const imports = result.relationships.filter(r => r.kind === 'imports');
            strict_1.default.ok(imports.length >= 5, `Expected >=5 imports, got ${imports.length}`);
            // Regular import
            const listImport = imports.find(r => r.targetSymbol === 'java.util.List');
            strict_1.default.ok(listImport, 'Should find java.util.List import');
            // Static import
            const staticImport = imports.find(r => r.metadata?.static === true);
            strict_1.default.ok(staticImport, 'Should find static import');
            // Wildcard import
            const wildcardImport = imports.find(r => r.metadata?.wildcard === true);
            strict_1.default.ok(wildcardImport, 'Should find wildcard import');
            strict_1.default.ok(wildcardImport.targetSymbol.endsWith('.*'));
        });
        (0, node_test_1.it)('should extract class with inheritance', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const cls = result.symbols.find(s => s.name === 'UserService' && s.kind === 'class');
            strict_1.default.ok(cls, 'Should find UserService class');
            strict_1.default.ok(cls.modifiers?.includes('public'));
            strict_1.default.ok(cls.isExported);
            // Inheritance
            const inherits = result.relationships.find(r => r.sourceSymbol === 'UserService' && r.kind === 'inherits');
            strict_1.default.ok(inherits, 'Should find extends BaseService');
            strict_1.default.equal(inherits.targetSymbol, 'BaseService');
            // Implements
            const implements_ = result.relationships.filter(r => r.sourceSymbol === 'UserService' && r.kind === 'implements');
            strict_1.default.ok(implements_.length >= 2, 'Should implement Serializable and Auditable');
        });
        (0, node_test_1.it)('should extract constructor', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const ctor = result.symbols.find(s => s.kind === 'constructor' && s.parentName === 'UserService');
            strict_1.default.ok(ctor, 'Should find UserService constructor');
            strict_1.default.ok(ctor.parameters?.includes('UserRepository'));
        });
        (0, node_test_1.it)('should extract methods with return types', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const findById = result.symbols.find(s => s.name === 'findById' && s.parentName === 'UserService');
            strict_1.default.ok(findById, 'Should find findById method');
            strict_1.default.equal(findById.kind, 'method');
            strict_1.default.ok(findById.modifiers?.includes('public'));
            const findAll = result.symbols.find(s => s.name === 'findAll');
            strict_1.default.ok(findAll, 'Should find findAll method');
        });
        (0, node_test_1.it)('should extract fields with modifiers', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            // Static final constant
            const constant = result.symbols.find(s => s.name === 'DEFAULT_ROLE');
            strict_1.default.ok(constant, 'Should find DEFAULT_ROLE constant');
            strict_1.default.equal(constant.kind, 'constant');
            strict_1.default.ok(constant.modifiers?.includes('static'));
            strict_1.default.ok(constant.modifiers?.includes('final'));
            // Regular field
            const field = result.symbols.find(s => s.name === 'repository');
            strict_1.default.ok(field, 'Should find repository field');
            strict_1.default.equal(field.kind, 'property');
        });
        (0, node_test_1.it)('should extract inner classes', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const inner = result.symbols.find(s => s.name === 'UserBuilder');
            strict_1.default.ok(inner, 'Should find UserBuilder inner class');
            strict_1.default.equal(inner.parentName, 'UserService');
            strict_1.default.ok(inner.modifiers?.includes('static'));
        });
        (0, node_test_1.it)('should extract method calls', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const calls = result.relationships.filter(r => r.kind === 'calls');
            strict_1.default.ok(calls.length > 0, 'Should find method calls');
            // Should find constructor calls (new X())
            const ctorCalls = calls.filter(r => r.targetSymbol.includes('.constructor'));
            strict_1.default.ok(ctorCalls.length > 0, 'Should find constructor calls (new X())');
        });
        (0, node_test_1.it)('should calculate complexity', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const findById = result.symbols.find(s => s.name === 'findById');
            strict_1.default.ok(findById, 'Should find findById');
            strict_1.default.ok((findById.complexity ?? 0) > 1, 'findById should have complexity > 1 (has if statement)');
        });
        (0, node_test_1.it)('should handle private methods', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.java');
            const result = parser.parse(source, 'SimpleClass.java');
            const privateMethod = result.symbols.find(s => s.name === 'notifyCreation');
            strict_1.default.ok(privateMethod, 'Should find notifyCreation');
            strict_1.default.ok(privateMethod.modifiers?.includes('private'));
            strict_1.default.equal(privateMethod.isExported, false);
        });
    });
    (0, node_test_1.describe)('parse — Annotations.java', () => {
        (0, node_test_1.it)('should extract annotations on classes', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('Annotations.java');
            const result = parser.parse(source, 'Annotations.java');
            const controller = result.symbols.find(s => s.name === 'UserController');
            strict_1.default.ok(controller, 'Should find UserController');
            strict_1.default.ok(controller.decorators?.includes('RestController'));
        });
        (0, node_test_1.it)('should extract annotations on methods', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('Annotations.java');
            const result = parser.parse(source, 'Annotations.java');
            const getUser = result.symbols.find(s => s.name === 'getUser');
            strict_1.default.ok(getUser, 'Should find getUser method');
            strict_1.default.ok(getUser.decorators?.includes('GetMapping'));
        });
        (0, node_test_1.it)('should extract record declarations', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('Annotations.java');
            const result = parser.parse(source, 'Annotations.java');
            const record = result.symbols.find(s => s.name === 'UserRecord');
            strict_1.default.ok(record, 'Should find UserRecord');
            strict_1.default.equal(record.kind, 'class');
            strict_1.default.ok(record.modifiers?.includes('record'));
        });
        (0, node_test_1.it)('should extract interfaces', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('Annotations.java');
            const result = parser.parse(source, 'Annotations.java');
            const iface = result.symbols.find(s => s.name === 'UserRepository');
            strict_1.default.ok(iface, 'Should find UserRepository interface');
            strict_1.default.equal(iface.kind, 'interface');
            // Should have extends relationship
            const inherits = result.relationships.find(r => r.sourceSymbol === 'UserRepository' && r.kind === 'inherits');
            strict_1.default.ok(inherits, 'Should find extends JpaRepository');
        });
        (0, node_test_1.it)('should extract enums', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('Annotations.java');
            const result = parser.parse(source, 'Annotations.java');
            const enumType = result.symbols.find(s => s.name === 'UserRole');
            strict_1.default.ok(enumType, 'Should find UserRole enum');
            strict_1.default.equal(enumType.kind, 'enum');
        });
        (0, node_test_1.it)('should create decorator relationships for annotations', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('Annotations.java');
            const result = parser.parse(source, 'Annotations.java');
            const decorates = result.relationships.filter(r => r.kind === 'decorates');
            strict_1.default.ok(decorates.length > 0, 'Should find decorator relationships');
            const restController = decorates.find(r => r.targetSymbol === 'RestController');
            strict_1.default.ok(restController, 'Should find @RestController decorator relationship');
        });
    });
    (0, node_test_1.describe)('error handling', () => {
        (0, node_test_1.it)('should handle empty source', () => {
            if (!grammarAvailable)
                return;
            const result = parser.parse('', 'Empty.java');
            strict_1.default.equal(result.symbols.length, 0);
            strict_1.default.equal(result.relationships.length, 0);
            strict_1.default.equal(result.errors.length, 0);
        });
        (0, node_test_1.it)('should handle source with syntax errors gracefully', () => {
            if (!grammarAvailable)
                return;
            const source = `
package com.example;

public class ValidClass {
    public void validMethod() {
        System.out.println("hello");
    }

    public void brokenMethod( {
        // syntax error
    }
}
`;
            const result = parser.parse(source, 'Broken.java');
            const validClass = result.symbols.find(s => s.name === 'ValidClass');
            strict_1.default.ok(validClass, 'Should still extract ValidClass');
        });
    });
});
//# sourceMappingURL=java-parser.test.js.map