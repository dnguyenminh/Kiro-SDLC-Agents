"use strict";
/**
 * ConfigurationManager — reads VS Code settings for backend connection.
 * Implements TDD §5.1 ConfigurationManager.
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
exports.ConfigurationManager = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../types/config");
class ConfigurationManager {
    static SECTION = 'codeIntel.backend';
    getConfiguration() {
        const vsConfig = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        return {
            port: vsConfig.get('port', config_1.DEFAULT_BACKEND_CONFIG.port),
            host: vsConfig.get('host', config_1.DEFAULT_BACKEND_CONFIG.host),
            backendPath: vsConfig.get('backendPath', config_1.DEFAULT_BACKEND_CONFIG.backendPath),
            autoStart: vsConfig.get('autoStart', config_1.DEFAULT_BACKEND_CONFIG.autoStart),
            healthCheckInterval: vsConfig.get('healthCheckInterval', config_1.DEFAULT_BACKEND_CONFIG.healthCheckInterval),
            startupTimeout: vsConfig.get('startupTimeout', config_1.DEFAULT_BACKEND_CONFIG.startupTimeout),
            compatRange: vsConfig.get('compatRange', config_1.DEFAULT_BACKEND_CONFIG.compatRange),
        };
    }
    onConfigurationChanged(listener) {
        return vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(ConfigurationManager.SECTION)) {
                listener(this.getConfiguration());
            }
        });
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=ConfigurationManager.js.map