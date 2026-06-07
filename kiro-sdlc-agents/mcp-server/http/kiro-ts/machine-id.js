"use strict";
/**
 * Machine ID Generator — KSA-237
 *
 * Generates/persists a stable 64-hex-char machineId used in the
 * KiroIDE User-Agent headers, mirroring kiro.rs `machine_id.rs`.
 *
 * Priority:
 * 1. Explicit machineId (normalized) if provided
 * 2. Derived from a stable seed (e.g. refreshToken/accessToken) via SHA-256
 * 3. Fallback: persisted random UUID seed under ~/.aws/sso/cache/kiro-ts-machine-id
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
exports.normalizeMachineId = normalizeMachineId;
exports.deriveMachineId = deriveMachineId;
exports.resolveMachineId = resolveMachineId;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const MACHINE_ID_FILE = 'kiro-ts-machine-id';
/**
 * Normalize a machineId into the canonical 64-hex-char form.
 * - 64-char hex → returned as-is (lowercased)
 * - UUID (32 hex after removing dashes) → duplicated to reach 64 chars
 * - otherwise → null
 */
function normalizeMachineId(machineId) {
    if (!machineId)
        return null;
    const trimmed = machineId.trim();
    if (trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return trimmed.toLowerCase();
    }
    const withoutDashes = trimmed.replace(/-/g, '');
    if (withoutDashes.length === 32 && /^[0-9a-fA-F]{32}$/.test(withoutDashes)) {
        const lower = withoutDashes.toLowerCase();
        return `${lower}${lower}`;
    }
    return null;
}
function sha256Hex(input) {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
/**
 * Derive a stable machineId from a seed string (e.g. refresh token).
 * Mirrors kiro.rs: sha256("KotlinNativeAPI/<refreshToken>").
 */
function deriveMachineId(seed, prefix = 'KotlinNativeAPI') {
    return sha256Hex(`${prefix}/${seed}`);
}
function getMachineIdPath() {
    return path.join(os.homedir(), '.aws', 'sso', 'cache', MACHINE_ID_FILE);
}
/**
 * Read or create a persisted fallback machineId.
 * Persists a random UUID-derived value so it stays stable across restarts.
 */
function getOrCreatePersistedMachineId() {
    const filePath = getMachineIdPath();
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8').trim();
            const normalized = normalizeMachineId(content);
            if (normalized)
                return normalized;
        }
    }
    catch {
        // ignore read errors — fall through to regenerate
    }
    const seed = crypto.randomUUID();
    const derived = sha256Hex(`KiroFallback/${seed}`);
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, derived, 'utf-8');
    }
    catch {
        // Non-fatal: if we cannot persist, the derived value is still stable for this process
    }
    return derived;
}
/**
 * Resolve the machineId to use for Kiro IDE headers.
 *
 * @param opts.explicit  An explicit machineId (config-provided) — highest priority
 * @param opts.seed      A stable seed (refresh token / access token) to derive from
 */
function resolveMachineId(opts) {
    const explicit = normalizeMachineId(opts?.explicit);
    if (explicit)
        return explicit;
    if (opts?.seed && opts.seed.length > 0) {
        return deriveMachineId(opts.seed);
    }
    return getOrCreatePersistedMachineId();
}
//# sourceMappingURL=machine-id.js.map