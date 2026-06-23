/**
 * SsoService — OpenID Connect + PKCE flow for SSO authentication.
 * Implements TDD §5.2, FSD UC-2, BR-6, BR-7, BR-26, BR-27.
 */
import { IDatabase } from './UserRepository';
import { SsoConfig, SsoAuthorizeResponse } from './types';
interface PendingSsoFlow {
    state: string;
    code_challenge: string;
    redirect_uri: string;
    created_at: number;
}
export declare class SsoService {
    private readonly db;
    private readonly pendingFlows;
    constructor(db: IDatabase);
    /**
     * Get active SSO configuration.
     */
    getConfig(): SsoConfig | null;
    /**
     * Initiate SSO authorization flow.
     * Returns authorization URL for the IdP.
     */
    authorize(codeChallenge: string, redirectUri: string): Promise<SsoAuthorizeResponse>;
    /**
     * Validate SSO callback state parameter.
     */
    validateState(state: string): PendingSsoFlow | null;
    /**
     * Check if an email domain is in the allowed list (BR-27).
     */
    isDomainAllowed(email: string): boolean;
    private cleanupExpiredFlows;
}
export declare class SsoError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export {};
//# sourceMappingURL=SsoService.d.ts.map