"use strict";
/**
 * KSA-151: Rust Parser — Unit Tests.
 * Tests symbol extraction, relationship detection, and Rust-specific features.
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
const rust_parser_js_1 = __importDefault(require("../rust-parser.js"));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
let rustParser;
async function setup() {
    await web_tree_sitter_1.Parser.init();
    const parser = new web_tree_sitter_1.Parser();
    const wasmPath = path.resolve(__dirname, '../../grammars/tree-sitter-rust.wasm');
    if (!fs.existsSync(wasmPath)) {
        console.error(`[skip] Rust WASM grammar not found at ${wasmPath}`);
        return null;
    }
    const language = await web_tree_sitter_1.Language.load(wasmPath);
    parser.setLanguage(language);
    return new rust_parser_js_1.default(parser, 'rust');
}
(0, node_test_1.describe)('RustParser', async () => {
    (0, node_test_1.before)(async () => {
        const p = await setup();
        if (!p) {
            console.error('Skipping Rust parser tests — WASM grammar not available');
            return;
        }
        rustParser = p;
    });
    (0, node_test_1.describe)('Symbol Extraction', () => {
        (0, node_test_1.it)('should extract functions', () => {
            if (!rustParser)
                return;
            const source = `pub fn hello(name: &str) -> String {
    format!("Hello, {}", name)
}

fn private_helper() {}`;
            const result = rustParser.parse(source, 'test.rs');
            const funcs = result.symbols.filter(s => s.kind === 'function');
            strict_1.default.equal(funcs.length, 2);
            const hello = funcs.find(f => f.name === 'hello');
            strict_1.default.equal(hello.isExported, true);
            strict_1.default.equal(hello.returnType, 'String');
            strict_1.default.ok(hello.signature.includes('fn hello'));
            const helper = funcs.find(f => f.name === 'private_helper');
            strict_1.default.equal(helper.isExported, false);
        });
        (0, node_test_1.it)('should extract async/unsafe functions', () => {
            if (!rustParser)
                return;
            const source = `pub async fn fetch(url: &str) -> Result<Vec<u8>, Error> {
    Ok(vec![])
}

pub unsafe fn raw_ptr(p: *mut u8) -> u8 {
    *p
}`;
            const result = rustParser.parse(source, 'test.rs');
            const funcs = result.symbols.filter(s => s.kind === 'function');
            const fetch = funcs.find(f => f.name === 'fetch');
            strict_1.default.equal(fetch.isAsync, true);
            strict_1.default.ok(fetch.modifiers?.includes('async'));
            const raw = funcs.find(f => f.name === 'raw_ptr');
            strict_1.default.ok(raw.modifiers?.includes('unsafe'));
        });
        (0, node_test_1.it)('should extract structs', () => {
            if (!rustParser)
                return;
            const source = `pub struct Config {
    host: String,
    port: u16,
}

struct Internal {
    data: Vec<u8>,
}`;
            const result = rustParser.parse(source, 'test.rs');
            const structs = result.symbols.filter(s => s.kind === 'struct');
            strict_1.default.equal(structs.length, 2);
            const config = structs.find(s => s.name === 'Config');
            strict_1.default.equal(config.isExported, true);
            const internal = structs.find(s => s.name === 'Internal');
            strict_1.default.equal(internal.isExported, false);
        });
        (0, node_test_1.it)('should extract enums', () => {
            if (!rustParser)
                return;
            const source = `pub enum Status {
    Active,
    Inactive,
    Error(String),
}`;
            const result = rustParser.parse(source, 'test.rs');
            const enums = result.symbols.filter(s => s.kind === 'enum');
            strict_1.default.equal(enums.length, 1);
            strict_1.default.equal(enums[0].name, 'Status');
        });
        (0, node_test_1.it)('should extract traits', () => {
            if (!rustParser)
                return;
            const source = `pub trait Serializable {
    fn serialize(&self) -> Vec<u8>;
    fn deserialize(data: &[u8]) -> Self;
}`;
            const result = rustParser.parse(source, 'test.rs');
            const traits = result.symbols.filter(s => s.kind === 'trait');
            strict_1.default.equal(traits.length, 1);
            strict_1.default.equal(traits[0].name, 'Serializable');
            // Trait methods should be extracted
            const methods = result.symbols.filter(s => s.kind === 'method' || (s.kind === 'function' && s.parentName === 'Serializable'));
            strict_1.default.ok(methods.length >= 2);
        });
        (0, node_test_1.it)('should extract impl blocks and methods', () => {
            if (!rustParser)
                return;
            const source = `struct Server {
    port: u16,
}

impl Server {
    pub fn new(port: u16) -> Self {
        Self { port }
    }

    pub fn start(&self) {
        println!("Starting on port {}", self.port);
    }

    fn internal_setup(&mut self) {}
}`;
            const result = rustParser.parse(source, 'test.rs');
            // Should have impl namespace
            const impls = result.symbols.filter(s => s.name.startsWith('impl '));
            strict_1.default.ok(impls.length >= 1);
            // Should have methods with parentName = Server
            const methods = result.symbols.filter(s => s.parentName === 'Server');
            strict_1.default.equal(methods.length, 3);
            strict_1.default.ok(methods.some(m => m.name === 'new'));
            strict_1.default.ok(methods.some(m => m.name === 'start'));
            strict_1.default.ok(methods.some(m => m.name === 'internal_setup'));
        });
        (0, node_test_1.it)('should extract trait implementations', () => {
            if (!rustParser)
                return;
            const source = `struct MyStruct;

trait Display {
    fn fmt(&self) -> String;
}

impl Display for MyStruct {
    fn fmt(&self) -> String {
        "MyStruct".to_string()
    }
}`;
            const result = rustParser.parse(source, 'test.rs');
            const implRels = result.relationships.filter(r => r.kind === 'implements');
            strict_1.default.ok(implRels.some(r => r.sourceSymbol === 'MyStruct' && r.targetSymbol === 'Display'));
        });
        (0, node_test_1.it)('should extract modules', () => {
            if (!rustParser)
                return;
            const source = `pub mod utils {
    pub fn helper() -> i32 {
        42
    }
}

mod internal;`;
            const result = rustParser.parse(source, 'test.rs');
            const modules = result.symbols.filter(s => s.kind === 'module');
            strict_1.default.equal(modules.length, 2);
            strict_1.default.ok(modules.some(m => m.name === 'utils'));
            strict_1.default.ok(modules.some(m => m.name === 'internal'));
            // Inline module should have children
            const helperFn = result.symbols.find(s => s.name === 'helper');
            strict_1.default.ok(helperFn);
            strict_1.default.equal(helperFn.parentName, 'utils');
        });
        (0, node_test_1.it)('should extract macro definitions', () => {
            if (!rustParser)
                return;
            const source = `macro_rules! my_macro {
    ($x:expr) => { $x + 1 };
}`;
            const result = rustParser.parse(source, 'test.rs');
            const macros = result.symbols.filter(s => s.modifiers?.includes('macro'));
            strict_1.default.equal(macros.length, 1);
            strict_1.default.equal(macros[0].name, 'my_macro');
        });
        (0, node_test_1.it)('should extract constants and statics', () => {
            if (!rustParser)
                return;
            const source = `pub const MAX_SIZE: usize = 1024;
static mut COUNTER: u32 = 0;`;
            const result = rustParser.parse(source, 'test.rs');
            strict_1.default.ok(result.symbols.some(s => s.name === 'MAX_SIZE'));
            strict_1.default.ok(result.symbols.some(s => s.name === 'COUNTER'));
        });
    });
    (0, node_test_1.describe)('Relationship Extraction', () => {
        (0, node_test_1.it)('should extract use declarations (simple)', () => {
            if (!rustParser)
                return;
            const source = `use std::collections::HashMap;
use std::io::Read;

fn main() {}`;
            const result = rustParser.parse(source, 'test.rs');
            const imports = result.relationships.filter(r => r.kind === 'imports');
            strict_1.default.ok(imports.some(i => i.targetSymbol === 'std::collections::HashMap'));
            strict_1.default.ok(imports.some(i => i.targetSymbol === 'std::io::Read'));
        });
        (0, node_test_1.it)('should expand grouped use paths', () => {
            if (!rustParser)
                return;
            const source = `use std::io::{self, Read, Write};

fn main() {}`;
            const result = rustParser.parse(source, 'test.rs');
            const imports = result.relationships.filter(r => r.kind === 'imports');
            strict_1.default.ok(imports.length >= 3, `Expected >= 3 imports, got ${imports.length}`);
        });
        (0, node_test_1.it)('should handle glob imports', () => {
            if (!rustParser)
                return;
            const source = `use std::prelude::*;

fn main() {}`;
            const result = rustParser.parse(source, 'test.rs');
            const imports = result.relationships.filter(r => r.kind === 'imports');
            const globImport = imports.find(i => i.metadata?.glob === true);
            strict_1.default.ok(globImport);
        });
        (0, node_test_1.it)('should handle pub use (re-exports)', () => {
            if (!rustParser)
                return;
            const source = `pub use crate::config::Settings;

fn main() {}`;
            const result = rustParser.parse(source, 'test.rs');
            const imports = result.relationships.filter(r => r.kind === 'imports');
            const pubUse = imports.find(i => i.metadata?.pub_use === true);
            strict_1.default.ok(pubUse);
        });
        (0, node_test_1.it)('should extract function calls', () => {
            if (!rustParser)
                return;
            const source = `fn main() {
    let x = compute(42);
    process(x);
}

fn compute(n: i32) -> i32 { n * 2 }
fn process(n: i32) {}`;
            const result = rustParser.parse(source, 'test.rs');
            const calls = result.relationships.filter(r => r.kind === 'calls');
            strict_1.default.ok(calls.some(c => c.targetSymbol === 'compute'));
            strict_1.default.ok(calls.some(c => c.targetSymbol === 'process'));
        });
        (0, node_test_1.it)('should extract macro invocations as calls', () => {
            if (!rustParser)
                return;
            const source = `fn main() {
    println!("hello");
    vec![1, 2, 3];
}`;
            const result = rustParser.parse(source, 'test.rs');
            const calls = result.relationships.filter(r => r.kind === 'calls' && r.metadata?.macro);
            strict_1.default.ok(calls.length >= 1);
        });
        (0, node_test_1.it)('should extract derive macro implementations', () => {
            if (!rustParser)
                return;
            const source = `#[derive(Debug, Clone, Serialize)]
pub struct Config {
    name: String,
}`;
            const result = rustParser.parse(source, 'test.rs');
            const implRels = result.relationships.filter(r => r.kind === 'implements' && r.metadata?.derived === true);
            strict_1.default.ok(implRels.some(r => r.sourceSymbol === 'Config' && r.targetSymbol === 'Debug'));
            strict_1.default.ok(implRels.some(r => r.sourceSymbol === 'Config' && r.targetSymbol === 'Clone'));
            strict_1.default.ok(implRels.some(r => r.sourceSymbol === 'Config' && r.targetSymbol === 'Serialize'));
        });
    });
    (0, node_test_1.describe)('Rust-Specific Features', () => {
        (0, node_test_1.it)('should handle visibility modifiers', () => {
            if (!rustParser)
                return;
            const source = `pub fn public_fn() {}
pub(crate) fn crate_fn() {}
fn private_fn() {}`;
            const result = rustParser.parse(source, 'test.rs');
            const funcs = result.symbols.filter(s => s.kind === 'function');
            const pubFn = funcs.find(f => f.name === 'public_fn');
            strict_1.default.equal(pubFn.isExported, true);
            const crateFn = funcs.find(f => f.name === 'crate_fn');
            strict_1.default.equal(crateFn.isExported, true);
            const privFn = funcs.find(f => f.name === 'private_fn');
            strict_1.default.equal(privFn.isExported, false);
        });
        (0, node_test_1.it)('should parse fixture file without errors', () => {
            if (!rustParser)
                return;
            const fixturePath = path.join(FIXTURES_DIR, 'simple.rs');
            if (!fs.existsSync(fixturePath))
                return;
            const source = fs.readFileSync(fixturePath, 'utf-8');
            const result = rustParser.parse(source, 'simple.rs');
            // Should have symbols
            strict_1.default.ok(result.symbols.length > 0, 'Should extract symbols');
            // Should have various kinds
            strict_1.default.ok(result.symbols.some(s => s.kind === 'function'));
            strict_1.default.ok(result.symbols.some(s => s.kind === 'struct'));
            strict_1.default.ok(result.symbols.some(s => s.kind === 'enum'));
            strict_1.default.ok(result.symbols.some(s => s.kind === 'trait'));
            // Should have relationships
            strict_1.default.ok(result.relationships.length > 0, 'Should extract relationships');
            // Should have imports
            strict_1.default.ok(result.relationships.some(r => r.kind === 'imports'));
        });
    });
});
//# sourceMappingURL=rust-parser.test.js.map