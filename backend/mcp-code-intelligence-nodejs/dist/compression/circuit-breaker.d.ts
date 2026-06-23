/**
 * CircuitBreaker — Resilience Wrapper
 * KSA-244: Auto-disable compression after repeated failures
 *
 * States: closed → open → half_open → closed
 * Threshold: 5 consecutive failures
 * Reset: 60 seconds
 */
import { CircuitBreakerState } from './types.js';
export declare class CircuitBreaker {
    private threshold;
    private resetMs;
    private state;
    constructor(threshold?: number, resetMs?: number);
    allowRequest(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    getState(): CircuitBreakerState;
    private transition;
}
//# sourceMappingURL=circuit-breaker.d.ts.map