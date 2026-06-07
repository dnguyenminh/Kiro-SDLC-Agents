/**
 * Health Checker — KSA-237
 * Diagnostic endpoint verifying credentials, API connectivity, and model availability.
 *
 * Connectivity is checked against the real Kiro AI endpoint
 * `q.{region}.amazonaws.com` (AWS CodeWhisperer), NOT the legacy
 * (non-existent) `kiro.api.*.amazonaws.com` host.
 */
import { HealthStatus } from './types.js';
/**
 * Perform health check — verifies credential availability, API connectivity, and model access.
 * Total timeout: 5 seconds (BR-10).
 */
export declare function checkHealth(): Promise<HealthStatus>;
//# sourceMappingURL=health-checker.d.ts.map