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

import * as os from 'os';

/** Kiro IDE version embedded in the KiroIDE-{version}-{machineId} UA token. */
export const KIRO_VERSION = process.env.KIRO_VERSION || '0.9.2';

/** Node runtime version reported in the SDK User-Agent string. */
export const NODE_VERSION = process.env.KIRO_NODE_VERSION || '22.21.1';

/** aws-sdk-js version reported in the sso-oidc refresh User-Agent. */
export const AWS_SDK_VERSION = process.env.KIRO_AWS_SDK_VERSION || '3.980.0';

/**
 * Build the `os/{platform}_{release}` fragment used in SDK User-Agent strings.
 * e.g. `win32_10.0.26100`.
 */
export function systemVersion(): string {
  return `${os.platform()}_${os.release()}`;
}
