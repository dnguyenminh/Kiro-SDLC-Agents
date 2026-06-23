"use strict";
/**
 * KSA-148: Python Parser Unit Tests.
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
const python_parser_js_1 = __importDefault(require("../python-parser.js"));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const GRAMMAR_PATH = path.resolve(__dirname, '../../grammars/tree-sitter-python.wasm');
let parser;
let grammarAvailable = false;
async function setup() {
    await web_tree_sitter_1.Parser.init();
    const tsParser = new web_tree_sitter_1.Parser();
    if (!fs.existsSync(GRAMMAR_PATH)) {
        console.error(`[SKIP] Python WASM grammar not found at ${GRAMMAR_PATH}`);
        return;
    }
    const language = await web_tree_sitter_1.Language.load(GRAMMAR_PATH);
    tsParser.setLanguage(language);
    parser = new python_parser_js_1.default(tsParser, 'python');
    grammarAvailable = true;
}
function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}
(0, node_test_1.describe)('PythonParser', () => {
    (0, node_test_1.before)(async () => {
        await setup();
    });
    (0, node_test_1.describe)('getSupportedExtensions', () => {
        (0, node_test_1.it)('should return .py and .pyi', () => {
            if (!grammarAvailable)
                return;
            strict_1.default.deepEqual(parser.getSupportedExtensions(), ['.py', '.pyi']);
        });
    });
    (0, node_test_1.describe)('parse — simple-function.py', () => {
        (0, node_test_1.it)('should extract module-level imports', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const imports = result.relationships.filter(r => r.kind === 'imports');
            strict_1.default.ok(imports.length >= 4, `Expected >=4 imports, got ${imports.length}`);
            // Check 'import os'
            const osImport = imports.find(r => r.targetSymbol === 'os');
            strict_1.default.ok(osImport, 'Should find import os');
            // Check 'from typing import List, Optional'
            const listImport = imports.find(r => r.targetSymbol === 'typing.List');
            strict_1.default.ok(listImport, 'Should find from typing import List');
            // Check relative import
            const relImport = imports.find(r => r.metadata?.relative === true);
            strict_1.default.ok(relImport, 'Should find relative import');
        });
        (0, node_test_1.it)('should extract module-level functions', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const simpleFunc = result.symbols.find(s => s.name === 'simple_function');
            strict_1.default.ok(simpleFunc, 'Should find simple_function');
            strict_1.default.equal(simpleFunc.kind, 'function');
            strict_1.default.equal(simpleFunc.returnType, 'int');
            strict_1.default.equal(simpleFunc.isExported, true);
            strict_1.default.ok(simpleFunc.signature?.includes('def simple_function'));
        });
        (0, node_test_1.it)('should extract async functions', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const asyncFunc = result.symbols.find(s => s.name === 'fetch_data');
            strict_1.default.ok(asyncFunc, 'Should find fetch_data');
            strict_1.default.equal(asyncFunc.isAsync, true);
            strict_1.default.ok(asyncFunc.modifiers?.includes('async'));
        });
        (0, node_test_1.it)('should extract classes with inheritance', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const cls = result.symbols.find(s => s.name === 'DataProcessor' && s.kind === 'class');
            strict_1.default.ok(cls, 'Should find DataProcessor class');
            strict_1.default.ok(cls.signature?.includes('BaseProcessor'));
            const inherits = result.relationships.find(r => r.sourceSymbol === 'DataProcessor' && r.kind === 'inherits');
            strict_1.default.ok(inherits, 'Should find inheritance relationship');
            strict_1.default.equal(inherits.targetSymbol, 'BaseProcessor');
        });
        (0, node_test_1.it)('should extract methods with decorators', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const staticMethod = result.symbols.find(s => s.name === 'validate' && s.parentName === 'DataProcessor');
            strict_1.default.ok(staticMethod, 'Should find validate method');
            strict_1.default.ok(staticMethod.modifiers?.includes('static'));
            const classMethod = result.symbols.find(s => s.name === 'from_file');
            strict_1.default.ok(classMethod, 'Should find from_file classmethod');
            strict_1.default.ok(classMethod.modifiers?.includes('classmethod'));
            const prop = result.symbols.find(s => s.name === 'cache_size');
            strict_1.default.ok(prop, 'Should find cache_size property');
            strict_1.default.equal(prop.kind, 'property');
        });
        (0, node_test_1.it)('should extract constructors', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const init = result.symbols.find(s => s.name === '__init__' && s.parentName === 'DataProcessor');
            strict_1.default.ok(init, 'Should find __init__');
            strict_1.default.equal(init.kind, 'constructor');
        });
        (0, node_test_1.it)('should extract module-level constants', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const constant = result.symbols.find(s => s.name === 'MAX_RETRIES');
            strict_1.default.ok(constant, 'Should find MAX_RETRIES constant');
            strict_1.default.equal(constant.kind, 'constant');
        });
        (0, node_test_1.it)('should mark private methods as not exported', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const privateMethod = result.symbols.find(s => s.name === '_internal_method');
            strict_1.default.ok(privateMethod, 'Should find _internal_method');
            strict_1.default.equal(privateMethod.isExported, false);
        });
        (0, node_test_1.it)('should extract function calls', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('simple-function.py');
            const result = parser.parse(source, 'simple-function.py');
            const calls = result.relationships.filter(r => r.kind === 'calls');
            strict_1.default.ok(calls.length > 0, 'Should find some calls');
        });
    });
    (0, node_test_1.describe)('parse — protocol-class.py', () => {
        (0, node_test_1.it)('should detect Protocol as interface', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('protocol-class.py');
            const result = parser.parse(source, 'protocol-class.py');
            const protocol = result.symbols.find(s => s.name === 'Serializable');
            strict_1.default.ok(protocol, 'Should find Serializable');
            strict_1.default.equal(protocol.kind, 'interface');
            const impl = result.relationships.find(r => r.sourceSymbol === 'Serializable' && r.kind === 'implements');
            strict_1.default.ok(impl, 'Should find implements Protocol relationship');
        });
        (0, node_test_1.it)('should detect ABC as abstract class', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('protocol-class.py');
            const result = parser.parse(source, 'protocol-class.py');
            const abc = result.symbols.find(s => s.name === 'AbstractHandler');
            strict_1.default.ok(abc, 'Should find AbstractHandler');
            strict_1.default.equal(abc.kind, 'class');
            strict_1.default.ok(abc.modifiers?.includes('abstract'));
        });
        (0, node_test_1.it)('should detect dataclass decorator', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('protocol-class.py');
            const result = parser.parse(source, 'protocol-class.py');
            const config = result.symbols.find(s => s.name === 'Config');
            strict_1.default.ok(config, 'Should find Config dataclass');
            strict_1.default.ok(config.modifiers?.includes('dataclass'));
            strict_1.default.ok(config.decorators?.includes('dataclass'));
        });
        (0, node_test_1.it)('should extract abstract methods', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('protocol-class.py');
            const result = parser.parse(source, 'protocol-class.py');
            const abstractMethod = result.symbols.find(s => s.name === 'handle' && s.parentName === 'AbstractHandler');
            strict_1.default.ok(abstractMethod, 'Should find abstract handle method');
            strict_1.default.ok(abstractMethod.modifiers?.includes('abstract'));
        });
        (0, node_test_1.it)('should extract docstrings', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('protocol-class.py');
            const result = parser.parse(source, 'protocol-class.py');
            const config = result.symbols.find(s => s.name === 'Config');
            strict_1.default.ok(config?.docComment, 'Config should have docstring');
            strict_1.default.ok(config.docComment.includes('Application configuration'));
        });
    });
    (0, node_test_1.describe)('error handling', () => {
        (0, node_test_1.it)('should handle empty source', () => {
            if (!grammarAvailable)
                return;
            const result = parser.parse('', 'empty.py');
            strict_1.default.equal(result.symbols.length, 0);
            strict_1.default.equal(result.relationships.length, 0);
            strict_1.default.equal(result.errors.length, 0);
        });
        (0, node_test_1.it)('should handle source with syntax errors gracefully', () => {
            if (!grammarAvailable)
                return;
            const source = `
def valid_function():
    pass

def broken_function(
    # missing closing paren and body

class ValidClass:
    pass
`;
            const result = parser.parse(source, 'broken.py');
            // Should still extract what it can
            const validFunc = result.symbols.find(s => s.name === 'valid_function');
            strict_1.default.ok(validFunc, 'Should still extract valid_function');
        });
    });
});
//# sourceMappingURL=python-parser.test.js.map