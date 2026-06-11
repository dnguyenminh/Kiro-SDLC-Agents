/**
 * SsoService — OpenID Connect + PKCE flow for SSO authentication.
 * Implements TDD §5.2, FSD UC-2, BR-6, BR-7, BR-26, BR-27.
 */

import { randomBytes } from 'node:crypto';
import { IDatabase } from './UserRepository';
import { SsoConfig, SsoAuthorizeResponse } from './types';

interface PendingSsoFlow {
  state: string;
  code_challenge: string;
  redirect_uri: string;
  created_at: number;
}

// BR-26: 30s callback timeout
const SSO_TIMEOUT_MS = 30_000;

export class SsoService {
  private readonly pendingFlows: Map<string, PendingSsoFlow> = new Map();

  constructor(private readonly db: IDatabase) {}

  /**
   * Get active SSO configuration.
   */
  getConfig(): SsoConfig | null {
    const stmt = this.db.prepare('SELECT * FROM sso_config WHERE enabled = 1 LIMIT 1');
    const row = stmt.get() as SsoConfig | undefined;
    return row ?? null;
  }

  /**
   * Initiate SSO authorization flow.
   * Returns authorization URL for the IdP.
   */
  async authorize(codeChallenge: string, redirectUri: string): Promise<SsoAuthorizeResponse> {
    const config = this.getConfig();
    if (!config) {
      throw new SsoError('SSO_NOT_CONFIGURED', 'SSO is not configured on this server.');
    }

    const state = randomBytes(16).toString('hex');

    // Store pending flow for callback validation
    this.pendingFlows.set(state, {
      state,
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
      created_at: Date.now(),
    });

    // Clean up expired flows
    this.cleanupExpiredFlows();

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.client_id,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authorizationUrl = `${config.issuer_url}/authorize?${params.toString()}`;

    return { authorization_url: authorizationUrl, state };
  }

  /**
   * Validate SSO callback state parameter.
   */
  validateState(state: string): PendingSsoFlow | null {
    const flow = this.pendingFlows.get(state);
    if (!flow) return null;

    // Check timeout (BR-26)
    if (Date.now() - flow.created_at > SSO_TIMEOUT_MS) {
      this.pendingFlows.delete(state);
      return null;
    }

    this.pendingFlows.delete(state);
    return flow;
  }

  /**
   * Check if an email domain is in the allowed list (BR-27).
   */
  isDomainAllowed(email: string): boolean {
    const config = this.getConfig();
    if (!config) return false;

    const allowedDomains = JSON.parse(config.allowed_domains) as string[];
    if (allowedDomains.length === 0) return true; // Empty = all domains allowed

    const domain = email.split('@')[1];
    return allowedDomains.includes(domain!);
  }

  private cleanupExpiredFlows(): void {
    const now = Date.now();
    for (const [state, flow] of this.pendingFlows) {
      if (now - flow.created_at > SSO_TIMEOUT_MS) {
        this.pendingFlows.delete(state);
      }
    }
  }
}

export class SsoError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SsoError';
  }
}
