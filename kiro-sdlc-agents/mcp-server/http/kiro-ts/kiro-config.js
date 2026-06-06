"use strict";
/**
 * Kiro Client Config — KSA-237
 *
 * Shared client-identity constants used by BOTH the chat handler
 * (generateAssistantResponse calls) and the token-refresh module
 * (refresh User-Agent headers), so they stay in sync.
 *
 * Mirrors kiro.rs defaults. Each value is overridable via an env var so the
 * gateway can track new Kiro IDE releases without a code change.
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
exports.AWS_SDK_VERSION = exports.NODE_VERSION = exports.KIRO_VERSION = void 0;
exports.systemVersion = systemVersion;
const os = __importStar(require("os"));
/** Kiro IDE version embedded in the KiroIDE-{version}-{machineId} UA token. */
exports.KIRO_VERSION = process.env.KIRO_VERSION || '0.9.2';
/** Node runtime version reported in the SDK User-Agent string. */
exports.NODE_VERSION = process.env.KIRO_NODE_VERSION || '22.21.1';
/** aws-sdk-js version reported in the sso-oidc refresh User-Agent. */
exports.AWS_SDK_VERSION = process.env.KIRO_AWS_SDK_VERSION || '3.980.0';
/**
 * Build the `os/{platform}_{release}` fragment used in SDK User-Agent strings.
 * e.g. `win32_10.0.26100`.
 */
function systemVersion() {
    return `${os.platform()}_${os.release()}`;
}
//# sourceMappingURL=kiro-config.js.map