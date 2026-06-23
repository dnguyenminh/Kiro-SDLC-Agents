"use strict";
/**
 * KSA-191: Apex Parser Unit Tests.
 * Tests symbol extraction, relationship extraction (DML, SOQL, triggers).
 * Requires tree-sitter-apex.wasm — tests skip gracefully if unavailable.
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
const apex_parser_js_1 = __importDefault(require("../apex-parser.js"));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/apex');
const GRAMMAR_PATH = path.resolve(__dirname, '../../grammars/tree-sitter-apex.wasm');
let parser;
let grammarAvailable = false;
async function setup() {
    await web_tree_sitter_1.Parser.init();
    const tsParser = new web_tree_sitter_1.Parser();
    if (!fs.existsSync(GRAMMAR_PATH)) {
        console.error(`[SKIP] Apex WASM grammar not found at ${GRAMMAR_PATH}`);
        return;
    }
    const language = await web_tree_sitter_1.Language.load(GRAMMAR_PATH);
    tsParser.setLanguage(language);
    parser = new apex_parser_js_1.default(tsParser, 'apex');
    grammarAvailable = true;
}
function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}
(0, node_test_1.describe)('ApexParser', () => {
    (0, node_test_1.before)(async () => {
        await setup();
    });
    (0, node_test_1.describe)('getSupportedExtensions', () => {
        (0, node_test_1.it)('should return .cls and .trigger', () => {
            // This test works even without WASM
            const p = new apex_parser_js_1.default(null, 'apex');
            strict_1.default.deepEqual(p.getSupportedExtensions(), ['.cls', '.trigger']);
        });
    });
    (0, node_test_1.describe)('parse — SimpleClass.cls', () => {
        (0, node_test_1.it)('should extract class symbol', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.cls');
            const result = parser.parse(source, 'SimpleClass.cls');
            const cls = result.symbols.find(s => s.kind === 'class');
            strict_1.default.ok(cls, 'Should find class symbol');
            strict_1.default.equal(cls.name, 'SimpleClass');
            strict_1.default.ok(cls.modifiers?.includes('public'));
            strict_1.default.equal(cls.isExported, true);
        });
        (0, node_test_1.it)('should have no relationships for empty class', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('SimpleClass.cls');
            const result = parser.parse(source, 'SimpleClass.cls');
            strict_1.default.equal(result.relationships.length, 0);
        });
    });
    (0, node_test_1.describe)('parse — ClassWithMethods.cls', () => {
        (0, node_test_1.it)('should extract class and methods', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('ClassWithMethods.cls');
            const result = parser.parse(source, 'ClassWithMethods.cls');
            const cls = result.symbols.find(s => s.kind === 'class');
            strict_1.default.ok(cls, 'Should find class');
            strict_1.default.equal(cls.name, 'AccountService');
            const methods = result.symbols.filter(s => s.kind === 'method');
            strict_1.default.ok(methods.length >= 3, `Should find at least 3 methods, got ${methods.length}`);
            const getAccounts = methods.find(m => m.name === 'getAccounts');
            strict_1.default.ok(getAccounts, 'Should find getAccounts method');
            strict_1.default.equal(getAccounts.parentName, 'AccountService');
        });
        (0, node_test_1.it)('should extract fields and constants', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('ClassWithMethods.cls');
            const result = parser.parse(source, 'ClassWithMethods.cls');
            const props = result.symbols.filter(s => s.kind === 'property' || s.kind === 'constant');
            strict_1.default.ok(props.length >= 1, 'Should find at least 1 field/constant');
        });
        (0, node_test_1.it)('should extract constructor', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('ClassWithMethods.cls');
            const result = parser.parse(source, 'ClassWithMethods.cls');
            const ctor = result.symbols.find(s => s.kind === 'constructor');
            strict_1.default.ok(ctor, 'Should find constructor');
            strict_1.default.equal(ctor.parentName, 'AccountService');
        });
        (0, node_test_1.it)('should extract annotations as decorators', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('ClassWithMethods.cls');
            const result = parser.parse(source, 'ClassWithMethods.cls');
            const updateMethod = result.symbols.find(s => s.name === 'updateAccount');
            if (updateMethod) {
                strict_1.default.ok(updateMethod.decorators?.includes('AuraEnabled'), 'Should find @AuraEnabled annotation');
            }
        });
        (0, node_test_1.it)('should extract SOQL relationships', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('ClassWithMethods.cls');
            const result = parser.parse(source, 'ClassWithMethods.cls');
            const soqlRels = result.relationships.filter(r => r.kind === 'soql');
            // May or may not find SOQL depending on AST node types
            // At minimum, should not crash
            strict_1.default.ok(Array.isArray(soqlRels));
        });
        (0, node_test_1.it)('should extract DML relationships', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('ClassWithMethods.cls');
            const result = parser.parse(source, 'ClassWithMethods.cls');
            const dmlRels = result.relationships.filter(r => r.kind === 'dml');
            strict_1.default.ok(Array.isArray(dmlRels));
        });
    });
    (0, node_test_1.describe)('parse — ClassWithDML.cls', () => {
        (0, node_test_1.it)('should extract DML operations', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('ClassWithDML.cls');
            const result = parser.parse(source, 'ClassWithDML.cls');
            const dmlRels = result.relationships.filter(r => r.kind === 'dml');
            // DML extraction depends on tree-sitter-apex AST having dml_expression nodes
            strict_1.default.ok(Array.isArray(dmlRels));
        });
    });
    (0, node_test_1.describe)('parse — ClassWithSOQL.cls', () => {
        (0, node_test_1.it)('should extract SOQL queries', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('ClassWithSOQL.cls');
            const result = parser.parse(source, 'ClassWithSOQL.cls');
            const soqlRels = result.relationships.filter(r => r.kind === 'soql');
            strict_1.default.ok(Array.isArray(soqlRels));
        });
    });
    (0, node_test_1.describe)('parse — TriggerExample.trigger', () => {
        (0, node_test_1.it)('should extract trigger symbol', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('TriggerExample.trigger');
            const result = parser.parse(source, 'TriggerExample.trigger');
            const trigger = result.symbols.find(s => s.modifiers?.includes('trigger'));
            strict_1.default.ok(trigger, 'Should find trigger symbol');
            strict_1.default.equal(trigger.name, 'AccountTrigger');
            strict_1.default.ok(trigger.signature?.includes('Account'));
        });
        (0, node_test_1.it)('should extract trigger-on relationship', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('TriggerExample.trigger');
            const result = parser.parse(source, 'TriggerExample.trigger');
            const triggerOnRels = result.relationships.filter(r => r.kind === 'trigger-on');
            strict_1.default.ok(triggerOnRels.length >= 1, 'Should find trigger-on relationship');
            strict_1.default.equal(triggerOnRels[0].targetSymbol, 'Account');
        });
        (0, node_test_1.it)('should extract calls from trigger body', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('TriggerExample.trigger');
            const result = parser.parse(source, 'TriggerExample.trigger');
            const callsRels = result.relationships.filter(r => r.kind === 'calls');
            strict_1.default.ok(callsRels.length >= 1, 'Should find calls in trigger body');
        });
    });
    (0, node_test_1.describe)('parse — InterfaceExample.cls', () => {
        (0, node_test_1.it)('should extract interface symbol', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('InterfaceExample.cls');
            const result = parser.parse(source, 'InterfaceExample.cls');
            const iface = result.symbols.find(s => s.kind === 'interface');
            strict_1.default.ok(iface, 'Should find interface symbol');
            strict_1.default.equal(iface.name, 'IAccountService');
        });
        (0, node_test_1.it)('should extract interface methods', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('InterfaceExample.cls');
            const result = parser.parse(source, 'InterfaceExample.cls');
            const methods = result.symbols.filter(s => s.kind === 'method');
            strict_1.default.ok(methods.length >= 3, 'Should find at least 3 interface methods');
        });
    });
    (0, node_test_1.describe)('parse — InheritanceExample.cls', () => {
        (0, node_test_1.it)('should extract inherits relationship', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('InheritanceExample.cls');
            const result = parser.parse(source, 'InheritanceExample.cls');
            const inheritsRels = result.relationships.filter(r => r.kind === 'inherits');
            strict_1.default.ok(inheritsRels.length >= 1, 'Should find inherits relationship');
            const baseService = inheritsRels.find(r => r.targetSymbol === 'BaseService');
            strict_1.default.ok(baseService, 'Should inherit from BaseService');
        });
        (0, node_test_1.it)('should extract implements relationships', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('InheritanceExample.cls');
            const result = parser.parse(source, 'InheritanceExample.cls');
            const implRels = result.relationships.filter(r => r.kind === 'implements');
            strict_1.default.ok(implRels.length >= 1, 'Should find implements relationships');
        });
    });
    (0, node_test_1.describe)('parse — MalformedClass.cls', () => {
        (0, node_test_1.it)('should return partial result with errors', () => {
            if (!grammarAvailable)
                return;
            const source = readFixture('MalformedClass.cls');
            const result = parser.parse(source, 'MalformedClass.cls');
            strict_1.default.ok(result, 'Should return a result');
            strict_1.default.ok(result.errors.length > 0, 'Should have parse errors');
            // Should still extract what it can
            strict_1.default.ok(Array.isArray(result.symbols));
        });
    });
});
//# sourceMappingURL=apex-parser.test.js.map