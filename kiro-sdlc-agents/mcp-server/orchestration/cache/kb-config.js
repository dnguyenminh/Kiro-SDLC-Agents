"use strict";
/**
 * KB Cache Config — reads tool_cache settings from orchestration.json.
 * KSA-139: Hot-reloadable config with sensible defaults.
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
exports.readKbCacheConfig = readKbCacheConfig;
exports.defaultKbCacheConfig = defaultKbCacheConfig;
const fs = __importStar(require("fs"));
const DEFAULTS = {
    enabled: true,
    injectCount: 5,
    lookupTimeoutMs: 100,
    maxEntriesPerScope: 100,
};
/** Read tool_cache config from orchestration.json settings. */
function readKbCacheConfig(configPath) {
    try {
        if (!fs.existsSync(configPath))
            return { ...DEFAULTS };
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const tc = raw?.settings?.tool_cache;
        if (!tc)
            return { ...DEFAULTS };
        return {
            enabled: tc.enabled ?? DEFAULTS.enabled,
            injectCount: clamp(tc.inject_count ?? DEFAULTS.injectCount, 0, 20),
            lookupTimeoutMs: clamp(tc.lookup_timeout_ms ?? DEFAULTS.lookupTimeoutMs, 50, 500),
            maxEntriesPerScope: clamp(tc.max_entries_per_scope ?? DEFAULTS.maxEntriesPerScope, 10, 500),
        };
    }
    catch (e) {
        console.error(`[kb-cache-config] Parse error, using defaults: ${e.message}`);
        return { ...DEFAULTS };
    }
}
/** Get default config (no file read). */
function defaultKbCacheConfig() {
    return { ...DEFAULTS };
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
//# sourceMappingURL=kb-config.js.map