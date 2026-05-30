"use strict";
/**
 * KSA-150: Go Parser — Unit Tests.
 * Tests symbol extraction, relationship detection, and Go-specific features.
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const go_parser_js_1 = __importDefault(require("../go-parser.js"));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
let goParser;
async function setup() {
    await web_tree_sitter_1.Parser.init();
    const parser = new web_tree_sitter_1.Parser();
    const wasmPath = path.resolve(__dirname, '../../grammars/tree-sitter-go.wasm');
    if (!fs.existsSync(wasmPath)) {
        console.error(`[skip] Go WASM grammar not found at ${wasmPath}`);
        return null;
    }
    const language = await web_tree_sitter_1.Language.load(wasmPath);
    parser.setLanguage(language);
    return new go_parser_js_1.default(parser, 'go');
}
(0, node_test_1.describe)('GoParser', async () => {
    (0, node_test_1.before)(async () => {
        const p = await setup();
        if (!p) {
            console.error('Skipping Go parser tests — WASM grammar not available');
            return;
        }
        goParser = p;
    });
    (0, node_test_1.describe)('Symbol Extraction', () => {
        (0, node_test_1.it)('should extract functions', () => {
            if (!goParser)
                return;
            const source = `package main

func Hello(name string) string {
  return "Hello, " + name
}`;
            const result = goParser.parse(source, 'test.go');
            const funcs = result.symbols.filter(s => s.kind === 'function');
            strict_1.default.equal(funcs.length, 1);
            strict_1.default.equal(funcs[0].name, 'Hello');
            strict_1.default.equal(funcs[0].isExported, true);
            strict_1.default.ok(funcs[0].signature.includes('func Hello'));
        });
        (0, node_test_1.it)('should extract methods with receivers', () => {
            if (!goParser)
                return;
            const source = `package main

type Server struct{}

func (s *Server) Start() error {
  return nil
}

func (s Server) Name() string {
  return "server"
}`;
            const result = goParser.parse(source, 'test.go');
            const methods = result.symbols.filter(s => s.kind === 'method');
            strict_1.default.equal(methods.length, 2);
            const start = methods.find(m => m.name === 'Start');
            strict_1.default.equal(start.parentName, 'Server');
            strict_1.default.ok(start.modifiers?.includes('pointer_receiver'));
            const nameMethod = methods.find(m => m.name === 'Name');
            strict_1.default.ok(nameMethod.modifiers?.includes('value_receiver'));
        });
        (0, node_test_1.it)('should extract structs', () => {
            if (!goParser)
                return;
            const source = `package main

type Config struct {
  Host string
  Port int
}`;
            const result = goParser.parse(source, 'test.go');
            const structs = result.symbols.filter(s => s.kind === 'struct');
            strict_1.default.equal(structs.length, 1);
            strict_1.default.equal(structs[0].name, 'Config');
            strict_1.default.equal(structs[0].isExported, true);
        });
        (0, node_test_1.it)('should extract interfaces', () => {
            if (!goParser)
                return;
            const source = `package main

type Reader interface {
  Read(p []byte) (n int, err error)
}`;
            const result = goParser.parse(source, 'test.go');
            const ifaces = result.symbols.filter(s => s.kind === 'interface');
            strict_1.default.equal(ifaces.length, 1);
            strict_1.default.equal(ifaces[0].name, 'Reader');
        });
        (0, node_test_1.it)('should detect exported vs unexported', () => {
            if (!goParser)
                return;
            const source = `package main

func PublicFunc() {}
func privateFunc() {}

type PublicType struct{}
type privateType struct{}`;
            const result = goParser.parse(source, 'test.go');
            const pub = result.symbols.filter(s => s.isExported);
            const priv = result.symbols.filter(s => !s.isExported);
            strict_1.default.equal(pub.length, 2);
            strict_1.default.equal(priv.length, 2);
        });
        (0, node_test_1.it)('should extract constants and variables', () => {
            if (!goParser)
                return;
            const source = `package main

const MaxSize = 100
var defaultName = "test"`;
            const result = goParser.parse(source, 'test.go');
            strict_1.default.ok(result.symbols.some(s => s.name === 'MaxSize'));
            strict_1.default.ok(result.symbols.some(s => s.name === 'defaultName'));
        });
    });
    (0, node_test_1.describe)('Relationship Extraction', () => {
        (0, node_test_1.it)('should extract function calls', () => {
            if (!goParser)
                return;
            const source = `package main

import "fmt"

func main() {
  fmt.Println("hello")
  doWork()
}

func doWork() {}`;
            const result = goParser.parse(source, 'test.go');
            const calls = result.relationships.filter(r => r.kind === 'calls');
            strict_1.default.ok(calls.some(c => c.targetSymbol.includes('fmt.Println')));
            strict_1.default.ok(calls.some(c => c.targetSymbol === 'doWork'));
        });
        (0, node_test_1.it)('should detect goroutine calls', () => {
            if (!goParser)
                return;
            const source = `package main

func main() {
  go processAsync()
}

func processAsync() {}`;
            const result = goParser.parse(source, 'test.go');
            const calls = result.relationships.filter(r => r.kind === 'calls');
            const asyncCall = calls.find(c => c.targetSymbol === 'processAsync');
            strict_1.default.ok(asyncCall);
            strict_1.default.equal(asyncCall?.metadata?.async, true);
        });
        (0, node_test_1.it)('should detect deferred calls', () => {
            if (!goParser)
                return;
            const source = `package main

func main() {
  defer cleanup()
}

func cleanup() {}`;
            const result = goParser.parse(source, 'test.go');
            const calls = result.relationships.filter(r => r.kind === 'calls');
            const deferredCall = calls.find(c => c.targetSymbol === 'cleanup');
            strict_1.default.ok(deferredCall);
            strict_1.default.equal(deferredCall?.metadata?.deferred, true);
        });
        (0, node_test_1.it)('should extract imports', () => {
            if (!goParser)
                return;
            const source = `package main

import (
  "fmt"
  "os"
  log "github.com/sirupsen/logrus"
)

func main() {}`;
            const result = goParser.parse(source, 'test.go');
            const imports = result.relationships.filter(r => r.kind === 'imports');
            strict_1.default.ok(imports.some(i => i.targetSymbol === 'fmt'));
            strict_1.default.ok(imports.some(i => i.targetSymbol === 'os'));
            strict_1.default.ok(imports.some(i => i.targetSymbol === 'github.com/sirupsen/logrus'));
        });
    });
    (0, node_test_1.describe)('Go-Specific Features', () => {
        (0, node_test_1.it)('should skip generated files', () => {
            if (!goParser)
                return;
            const source = `// Code generated by protoc-gen-go. DO NOT EDIT.
package main

func GeneratedFunc() {}`;
            const result = goParser.parse(source, 'test.go');
            strict_1.default.equal(result.symbols.length, 0);
        });
        (0, node_test_1.it)('should handle multiple return values', () => {
            if (!goParser)
                return;
            const source = `package main

func divide(a, b int) (int, error) {
  return a / b, nil
}`;
            const result = goParser.parse(source, 'test.go');
            const fn = result.symbols.find(s => s.name === 'divide');
            strict_1.default.ok(fn);
            strict_1.default.ok(fn.returnType?.includes('int'));
        });
        (0, node_test_1.it)('should parse fixture file without errors', () => {
            if (!goParser)
                return;
            const fixturePath = path.join(FIXTURES_DIR, 'simple.go');
            if (!fs.existsSync(fixturePath))
                return;
            const source = fs.readFileSync(fixturePath, 'utf-8');
            const result = goParser.parse(source, 'simple.go');
            // Should have symbols
            strict_1.default.ok(result.symbols.length > 0, 'Should extract symbols');
            // Should have functions, methods, structs, interfaces
            strict_1.default.ok(result.symbols.some(s => s.kind === 'function'));
            strict_1.default.ok(result.symbols.some(s => s.kind === 'method'));
            strict_1.default.ok(result.symbols.some(s => s.kind === 'struct'));
            strict_1.default.ok(result.symbols.some(s => s.kind === 'interface'));
            // Should have relationships
            strict_1.default.ok(result.relationships.length > 0, 'Should extract relationships');
        });
    });
});
//# sourceMappingURL=go-parser.test.js.map