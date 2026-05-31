"use strict";
/**
 * KSA-162: Entry Point Detector — Main orchestrator.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryPointDetector = void 0;
const PatternRegistry_js_1 = require("./PatternRegistry.js");
const FrameworkDetector_js_1 = require("./FrameworkDetector.js");
const EntryPointStore_js_1 = require("./EntryPointStore.js");
const HTTPHandlerDetector_js_1 = require("./detectors/HTTPHandlerDetector.js");
const MainDetector_js_1 = require("./detectors/MainDetector.js");
const CLIDetector_js_1 = require("./detectors/CLIDetector.js");
const EventDetector_js_1 = require("./detectors/EventDetector.js");
class EntryPointDetector {
    registry;
    frameworkDetector;
    httpDetector;
    mainDetector;
    cliDetector;
    eventDetector;
    store;
    db;
    constructor(db) {
        this.db = db;
        this.registry = new PatternRegistry_js_1.PatternRegistry();
        this.frameworkDetector = new FrameworkDetector_js_1.FrameworkDetector(this.registry);
        this.httpDetector = new HTTPHandlerDetector_js_1.HTTPHandlerDetector(this.registry);
        this.mainDetector = new MainDetector_js_1.MainDetector(this.registry);
        this.cliDetector = new CLIDetector_js_1.CLIDetector();
        this.eventDetector = new EventDetector_js_1.EventDetector();
        this.store = new EntryPointStore_js_1.EntryPointStore(db);
    }
    /** Detect all entry points in a file. */
    detectFile(filePath, source, language, symbols) {
        const allEntryPoints = [];
        // 1. Detect framework
        const framework = this.frameworkDetector.detect(source, language);
        // 2. HTTP handlers (if framework detected)
        if (framework) {
            const httpEntries = this.httpDetector.detectFromSymbols(symbols, framework.name, source);
            allEntryPoints.push(...httpEntries);
        }
        // 3. Main functions
        const mainEntries = this.mainDetector.detect(symbols, source, language);
        allEntryPoints.push(...mainEntries);
        // 4. CLI commands
        const cliEntries = this.cliDetector.detect(symbols, source);
        allEntryPoints.push(...cliEntries);
        // 5. Event handlers
        const eventEntries = this.eventDetector.detect(symbols, source);
        allEntryPoints.push(...eventEntries);
        // Store results
        if (allEntryPoints.length > 0) {
            this.store.upsertBatch(allEntryPoints);
        }
        return allEntryPoints;
    }
    /** Query stored entry points. */
    query(filters) {
        return this.store.query(filters);
    }
}
exports.EntryPointDetector = EntryPointDetector;
//# sourceMappingURL=EntryPointDetector.js.map