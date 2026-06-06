/**
 * SigV4 Signer — KSA-237
 * AWS Signature Version 4 signing for Kiro AI API requests.
 * Uses Node.js built-in crypto module (zero external dependencies).
 */
import { AWSCredentials } from './types.js';
export interface SignedRequest {
    headers: Record<string, string>;
}
export interface SignOptions {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    credentials: AWSCredentials;
    region: string;
    service?: string;
    datetime?: string;
}
/**
 * Sign an HTTP request using AWS SigV4.
 * Returns additional headers to add to the request.
 */
export declare function signRequest(options: SignOptions): SignedRequest;
//# sourceMappingURL=sigv4-signer.d.ts.map