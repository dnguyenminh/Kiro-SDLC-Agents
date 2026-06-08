/**
 * CompressionMetrics — Observability
 * KSA-244: Tracks compression ratios, timing, cache hits, failures
 */

import { CompressionResult, MetricsEntry } from './types.js';

export class CompressionMetrics {
  private entries: MetricsEntry[] = [];
  private maxEntries = 1000;

  record(result: CompressionResult, durationMs: number, cacheHit: boolean = false): void {
    const entry: MetricsEntry = {
      timestamp: Date.now(),
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      ratio: result.ratio,
      strategy: result.strategy,
      durationMs,
      cacheHit,
      skipped: result.skipped,
    };

    this.entries.push(entry);

    // Bounded buffer
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getSummary(): {
    totalCompressions: number;
    avgRatio: number;
    avgDurationMs: number;
    cacheHitRate: number;
    skipRate: number;
    p99DurationMs: number;
  } {
    if (this.entries.length === 0) {
      return { totalCompressions: 0, avgRatio: 0, avgDurationMs: 0, cacheHitRate: 0, skipRate: 0, p99DurationMs: 0 };
    }

    const total = this.entries.length;
    const ratioSum = this.entries.reduce((s, e) => s + e.ratio, 0);
    const durationSum = this.entries.reduce((s, e) => s + e.durationMs, 0);
    const cacheHits = this.entries.filter(e => e.cacheHit).length;
    const skipped = this.entries.filter(e => e.skipped).length;

    // p99 duration
    const sorted = [...this.entries].sort((a, b) => a.durationMs - b.durationMs);
    const p99Index = Math.floor(sorted.length * 0.99);
    const p99 = sorted[p99Index]?.durationMs ?? 0;

    return {
      totalCompressions: total,
      avgRatio: ratioSum / total,
      avgDurationMs: durationSum / total,
      cacheHitRate: cacheHits / total,
      skipRate: skipped / total,
      p99DurationMs: p99,
    };
  }

  getRecentEntries(count: number = 10): MetricsEntry[] {
    return this.entries.slice(-count);
  }
}
