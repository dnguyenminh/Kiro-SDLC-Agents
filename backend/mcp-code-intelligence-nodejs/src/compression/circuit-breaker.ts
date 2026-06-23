/**
 * CircuitBreaker — Resilience Wrapper
 * KSA-244: Auto-disable compression after repeated failures
 * 
 * States: closed → open → half_open → closed
 * Threshold: 5 consecutive failures
 * Reset: 60 seconds
 */

import { CircuitBreakerState } from './types.js';

export class CircuitBreaker {
  private state: CircuitBreakerState;

  constructor(
    private threshold: number = 5,
    private resetMs: number = 60_000,
  ) {
    this.state = {
      state: 'closed',
      failures: 0,
      lastFailureAt: 0,
      lastStateChange: Date.now(),
    };
  }

  allowRequest(): boolean {
    switch (this.state.state) {
      case 'closed':
        return true;
      case 'open': {
        const elapsed = Date.now() - this.state.lastStateChange;
        if (elapsed >= this.resetMs) {
          this.transition('half_open');
          return true;
        }
        return false;
      }
      case 'half_open':
        return false;
      default:
        return true;
    }
  }

  recordSuccess(): void {
    if (this.state.state === 'half_open') {
      this.transition('closed');
    }
    this.state.failures = 0;
  }

  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureAt = Date.now();
    if (this.state.state === 'half_open') {
      this.transition('open');
    } else if (this.state.failures >= this.threshold) {
      this.transition('open');
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  private transition(newState: 'closed' | 'open' | 'half_open'): void {
    this.state.state = newState;
    this.state.lastStateChange = Date.now();
    if (newState === 'closed') {
      this.state.failures = 0;
    }
  }
}
