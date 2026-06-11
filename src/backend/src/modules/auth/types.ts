/**
 * Auth module types.
 * Implements TDD §5.2 modules/auth/types.ts, FSD §3.11 Business Rules.
 */

export interface AuthPayload {
  userId: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  projects: string[];
  iat: number;
  exp: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface LoginResponse extends TokenPair {
  user: UserPublic;
}

export interface UserPublic {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
  projects: string[];
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  password_hash: string | null;
  role: 'user' | 'admin';
  sso_provider: string | null;
  sso_subject: string | null;
  projects: string; // JSON array stored as text
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  issued_at: string;
  expires_at: string;
  revoked: number;
  revoked_at: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SsoConfig {
  id: string;
  issuer_url: string;
  client_id: string;
  allowed_domains: string; // JSON array
  redirect_uri: string;
  enabled: number;
  created_at: string;
}

export interface SsoAuthorizeRequest {
  code_challenge: string;
  redirect_uri: string;
}

export interface SsoAuthorizeResponse {
  authorization_url: string;
  state: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
