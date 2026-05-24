"use strict";
/**
 * Config hot-reload watcher — uses fs.watchFile to detect changes.
 * Behavioral parity with Kotlin ConfigWatcher.kt.
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
exports.ConfigWatcher = void 0;
const fs = __importStar(require("fs"));
const config_js_1 = require("../config.js");
const path = __importStar(require("path"));
class ConfigWatcher {
    configPath;
    onReload;
    watching = false;
    constructor(configPath, onReload) {
        this.configPath = configPath;
        this.onReload = onReload;
    }
    /** Start watching config file. */
    start() {
        if (this.watching)
            return;
        this.watching = true;
        fs.watchFile(this.configPath, { interval: 2000 }, () => this.handleChange());
        console.error(`[orchestration] ConfigWatcher started for: ${this.configPath}`);
    }
    /** Stop watching. */
    stop() {
        if (!this.watching)
            return;
        fs.unwatchFile(this.configPath);
        this.watching = false;
        console.error('[orchestration] ConfigWatcher stopped');
    }
    handleChange() {
        console.error('[orchestration] Config file changed, reloading...');
        const workspace = path.dirname(path.dirname(this.configPath));
        const config = (0, config_js_1.loadOrchestrationConfig)(workspace);
        if (config) {
            this.onReload(config);
            const count = Object.keys(config.mcpServers).filter((k) => !config.mcpServers[k].disabled).length;
            console.error(`[orchestration] Config reloaded: ${count} servers`);
        }
        else {
            console.error('[orchestration] Config reload failed — keeping current config');
        }
    }
}
exports.ConfigWatcher = ConfigWatcher;
//# sourceMappingURL=watcher.js.map