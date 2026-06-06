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
/**
 * Normalize a machineId into the canonical 64-hex-char form.
 * - 64-char hex → returned as-is (lowercased)
 * - UUID (32 hex after removing dashes) → duplicated to reach 64 chars
 * - otherwise → null
 */
export declare function normalizeMachineId(machineId: string | undefined | null): string | null;
/**
 * Derive a stable machineId from a seed string (e.g. refresh token).
 * Mirrors kiro.rs: sha256("KotlinNativeAPI/<refreshToken>").
 */
export declare function deriveMachineId(seed: string, prefix?: string): string;
/**
 * Resolve the machineId to use for Kiro IDE headers.
 *
 * @param opts.explicit  An explicit machineId (config-provided) — highest priority
 * @param opts.seed      A stable seed (refresh token / access token) to derive from
 */
export declare function resolveMachineId(opts?: {
    explicit?: string | null;
    seed?: string | null;
}): string;
//# sourceMappingURL=machine-id.d.ts.map