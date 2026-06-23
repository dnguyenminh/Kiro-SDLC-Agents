"use strict";
/**
 * PkceService — PKCE (Proof Key for Code Exchange) code verifier/challenge generation.
 * Used for SSO OAuth2 flows with S256 challenge method.
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
exports.PkceService = void 0;
const crypto = __importStar(require("crypto"));
class PkceService {
    /**
     * Generate a cryptographically random code verifier (43-128 chars, base64url).
     */
    generateCodeVerifier() {
        const bytes = crypto.randomBytes(32);
        return this.base64UrlEncode(bytes);
    }
    /**
     * Generate SHA-256 code challenge from verifier.
     */
    generateCodeChallenge(verifier) {
        const hash = crypto.createHash("sha256").update(verifier).digest();
        return this.base64UrlEncode(hash);
    }
    base64UrlEncode(buffer) {
        return buffer
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }
}
exports.PkceService = PkceService;
//# sourceMappingURL=PkceService.js.map