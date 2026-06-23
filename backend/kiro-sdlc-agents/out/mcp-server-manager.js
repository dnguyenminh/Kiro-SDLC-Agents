"use strict";
/**
 * McpServerManager — Proxy class for RemoteBackendClient (KSA-293).
 *
 * Preserves the old McpServerManager class name to minimize refactoring across UI panels,
 * but implements the new Light Client architecture connecting to the remote backend.
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
exports.McpServerManager = void 0;
exports.getNonce = getNonce;
var remote_backend_client_1 = require("./remote-backend-client");
Object.defineProperty(exports, "McpServerManager", { enumerable: true, get: function () { return remote_backend_client_1.RemoteBackendClient; } });
// Re-export getNonce utility that some panels import from this module
const crypto = __importStar(require("crypto"));
/**
 * Generate a cryptographic nonce for CSP script authorization.
 */
function getNonce() {
    const array = crypto.randomBytes(16);
    return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
//# sourceMappingURL=mcp-server-manager.js.map