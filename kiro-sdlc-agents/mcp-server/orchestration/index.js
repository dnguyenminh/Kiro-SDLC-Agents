"use strict";
/**
 * Orchestration module — child MCP server management, tool discovery, fallback chains.
 * Public API: OrchestrationEngine, loadOrchestrationConfig.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadOrchestrationConfig = exports.OrchestrationEngine = void 0;
var engine_js_1 = require("./engine.js");
Object.defineProperty(exports, "OrchestrationEngine", { enumerable: true, get: function () { return engine_js_1.OrchestrationEngine; } });
var config_js_1 = require("./config.js");
Object.defineProperty(exports, "loadOrchestrationConfig", { enumerable: true, get: function () { return config_js_1.loadOrchestrationConfig; } });
//# sourceMappingURL=index.js.map