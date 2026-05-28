"use strict";
/**
 * Orchestration configuration — interfaces and loader.
 * Reads orchestration.json from .code-intel/ directory.
 * Same format as Kotlin OrchestrationConfig.kt.
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
exports.loadOrchestrationConfig = loadOrchestrationConfig;
exports.loadOrchestrationConfigFromPath = loadOrchestrationConfigFromPath;
exports.enabledServers = enabledServers;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_SETTINGS = {
    autoLog: { enabled: true, excludeTools: ['mem_audit'], maxArgLength: 200 },
    healthCheckIntervalMs: 30_000,
    maxRestartRetries: 3,
    similarityThreshold: 0.7,
    maxRecursionDepth: 3,
    discoveryTimeoutMs: 10_000,
    kbSearchTimeoutMs: 2_000,
};
/** Load orchestration.json from workspace .code-intel/ directory. */
function loadOrchestrationConfig(workspace) {
    const configPath = path.join(workspace, '.code-intel', 'orchestration.json');
    return loadOrchestrationConfigFromPath(configPath);
}
/** Load orchestration config from an explicit file path. */
function loadOrchestrationConfigFromPath(configPath) {
    if (!fs.existsSync(configPath))
        return null;
    try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return parseConfig(data);
    }
    catch (e) {
        console.error(`[orchestration] Config load failed: ${e.message}`);
        return null;
    }
}
/** Get enabled (non-disabled) servers. */
function enabledServers(config) {
    const result = new Map();
    for (const [name, entry] of Object.entries(config.mcpServers)) {
        if (!entry.disabled)
            result.set(name, entry);
    }
    return result;
}
function parseConfig(data) {
    const servers = {};
    for (const [name, entry] of Object.entries(data.mcpServers ?? {})) {
        const e = entry;
        servers[name] = {
            command: e.command,
            args: e.args ?? [],
            env: e.env ?? {},
            url: e.url,
            transportType: e.transportType,
            disabled: e.disabled ?? false,
            timeout: e.timeout ?? 30_000,
            autoApprove: e.autoApprove ?? [],
        };
    }
    const s = data.settings ?? {};
    const al = s.autoLog ?? {};
    const settings = {
        autoLog: {
            enabled: al.enabled ?? DEFAULT_SETTINGS.autoLog.enabled,
            excludeTools: al.excludeTools ?? DEFAULT_SETTINGS.autoLog.excludeTools,
            maxArgLength: al.maxArgLength ?? DEFAULT_SETTINGS.autoLog.maxArgLength,
        },
        healthCheckIntervalMs: s.healthCheckIntervalMs ?? DEFAULT_SETTINGS.healthCheckIntervalMs,
        maxRestartRetries: s.maxRestartRetries ?? DEFAULT_SETTINGS.maxRestartRetries,
        similarityThreshold: s.similarityThreshold ?? DEFAULT_SETTINGS.similarityThreshold,
        maxRecursionDepth: s.maxRecursionDepth ?? DEFAULT_SETTINGS.maxRecursionDepth,
        discoveryTimeoutMs: s.discoveryTimeoutMs ?? DEFAULT_SETTINGS.discoveryTimeoutMs,
        kbSearchTimeoutMs: s.kbSearchTimeoutMs ?? DEFAULT_SETTINGS.kbSearchTimeoutMs,
    };
    return { mcpServers: servers, settings };
}
//# sourceMappingURL=config.js.map