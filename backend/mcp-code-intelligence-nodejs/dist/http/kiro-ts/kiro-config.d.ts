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
/** Kiro IDE version embedded in the KiroIDE-{version}-{machineId} UA token. */
export declare const KIRO_VERSION: string;
/** Node runtime version reported in the SDK User-Agent string. */
export declare const NODE_VERSION: string;
/** aws-sdk-js version reported in the sso-oidc refresh User-Agent. */
export declare const AWS_SDK_VERSION: string;
/**
 * Build the `os/{platform}_{release}` fragment used in SDK User-Agent strings.
 * e.g. `win32_10.0.26100`.
 */
export declare function systemVersion(): string;
//# sourceMappingURL=kiro-config.d.ts.map