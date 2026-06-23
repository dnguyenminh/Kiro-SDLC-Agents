/**
 * AuthService — business logic for authentication.
 * Implements TDD §5.2, FSD UC-1, UC-2, UC-3, UC-10.
 * Handles login, token refresh, logout, account lockout (BR-4).
 */
import { randomUUID } from 'node:crypto';
// BR-4: Account lockout after 5 failed attempts, 15 min cooldown
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
export class AuthService {
    userRepo;
    sessionRepo;
    tokenService;
    passwordService;
    constructor(userRepo, sessionRepo, tokenService, passwordService) {
        this.userRepo = userRepo;
        this.sessionRepo = sessionRepo;
        this.tokenService = tokenService;
        this.passwordService = passwordService;
    }
    /**
     * Local login with username/password.
     * Implements UC-1, BR-4, BR-5.
     */
    async login(username, password, userAgent) {
        const user = this.userRepo.findByUsername(username);
        if (!user) {
            throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Invalid username or password.', 401);
        }
        // Check account lockout (BR-4)
        if (user.locked_until) {
            const lockUntil = new Date(user.locked_until);
            if (lockUntil > new Date()) {
                const remainingMinutes = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
                throw new AuthError('AUTH_ACCOUNT_LOCKED', `Account locked. Try again in ${remainingMinutes} minutes.`, 403, { locked_until: user.locked_until, remaining_minutes: remainingMinutes });
            }
            // Lockout expired — reset
            this.userRepo.resetFailedAttempts(user.id);
        }
        // Verify password
        if (!user.password_hash) {
            throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Invalid username or password.', 401);
        }
        const valid = await this.passwordService.verify(password, user.password_hash);
        if (!valid) {
            this.userRepo.incrementFailedAttempts(user.id);
            const updatedUser = this.userRepo.findById(user.id);
            if (updatedUser.failed_attempts >= MAX_FAILED_ATTEMPTS) {
                const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
                this.userRepo.lockAccount(user.id, lockUntil);
                throw new AuthError('AUTH_ACCOUNT_LOCKED', `Account locked. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.`, 403, { locked_until: lockUntil.toISOString(), remaining_minutes: LOCKOUT_DURATION_MINUTES });
            }
            throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Invalid username or password.', 401);
        }
        // Successful login — reset failed attempts
        this.userRepo.resetFailedAttempts(user.id);
        // Generate tokens
        const projects = JSON.parse(user.projects);
        const tokenPair = await this.tokenService.generateTokenPair({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            projects,
        });
        // Store session
        const sessionId = randomUUID();
        const refreshHash = this.tokenService.hashRefreshToken(tokenPair.refresh_token);
        const expiresAt = this.tokenService.getRefreshTokenExpiry();
        this.sessionRepo.create({
            id: sessionId,
            user_id: user.id,
            refresh_token_hash: refreshHash,
            expires_at: expiresAt.toISOString(),
            user_agent: userAgent,
        });
        return {
            ...tokenPair,
            user: this.toPublicUser(user, projects),
        };
    }
    /**
     * Refresh access token using valid refresh token.
     * Implements UC-3, BR-3.
     */
    async refresh(refreshToken) {
        const hash = this.tokenService.hashRefreshToken(refreshToken);
        const session = this.sessionRepo.findByRefreshTokenHash(hash);
        if (!session) {
            throw new AuthError('AUTH_REFRESH_INVALID', 'Refresh token expired or revoked. Please log in again.', 401);
        }
        const user = this.userRepo.findById(session.user_id);
        if (!user) {
            throw new AuthError('AUTH_REFRESH_INVALID', 'User not found.', 401);
        }
        // Revoke old session
        this.sessionRepo.revoke(session.id);
        // Generate new token pair
        const projects = JSON.parse(user.projects);
        const tokenPair = await this.tokenService.generateTokenPair({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            projects,
        });
        // Create new session
        const sessionId = randomUUID();
        const newHash = this.tokenService.hashRefreshToken(tokenPair.refresh_token);
        const expiresAt = this.tokenService.getRefreshTokenExpiry();
        this.sessionRepo.create({
            id: sessionId,
            user_id: user.id,
            refresh_token_hash: newHash,
            expires_at: expiresAt.toISOString(),
        });
        return tokenPair;
    }
    /**
     * Logout — revoke refresh token server-side.
     * Implements UC-10, BR-18.
     */
    logout(refreshToken) {
        const hash = this.tokenService.hashRefreshToken(refreshToken);
        this.sessionRepo.revokeByRefreshTokenHash(hash);
    }
    /**
     * Verify JWT and return payload.
     */
    async verifyToken(token) {
        return this.tokenService.verifyAccessToken(token);
    }
    toPublicUser(user, projects) {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
            projects,
        };
    }
}
/**
 * Custom auth error with HTTP status code.
 */
export class AuthError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AuthError';
    }
}
//# sourceMappingURL=AuthService.js.map