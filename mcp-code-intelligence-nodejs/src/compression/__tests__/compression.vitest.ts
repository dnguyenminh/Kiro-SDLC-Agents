/**
 * Compression Module Tests — KSA-244
 * Covers: ContentRouter, SmartCrusher, CompressionCache, CircuitBreaker, CacheAligner, Pipeline
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ContentRouter } from '../content-router.js';
import { SmartCrusher } from '../smart-crusher.js';
import { CompressionCache } from '../compression-cache.js';
import { CircuitBreaker } from '../circuit-breaker.js';
import { CacheAligner } from '../cache-aligner.js';

// ─── ContentRouter Tests ────────────────────────────────────────────────
describe('ContentRouter', () => {
  let router: ContentRouter;
  beforeEach(() => { router = new ContentRouter(); });

  it('UT-01: detects JSON array', () => {
    const arr = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `item${i}`, value: Math.random() }));
    const content = JSON.stringify(arr);
    const result = router.detect(content);
    expect(result.type).toBe('json');
    expect(result.shouldCompress).toBe(true);
    expect(result.compressor).toBe('smartCrusher');
  });

  it('UT-02: detects JSON array with whitespace', () => {
    const arr = Array.from({ length: 10 }, (_, i) => ({ id: i, data: 'x'.repeat(10) }));
    const content = '  \n' + JSON.stringify(arr) + '\n';
    expect(router.detect(content).type).toBe('json');
  });

  it('UT-03: detects source code', () => {
    const code = 'import * as fs from "fs";\n\nexport function readFile(path: string): string {\n  return fs.readFileSync(path, "utf8");\n}\n' + 'x'.repeat(50);
    expect(router.detect(code).type).toBe('code');
  });

  it('UT-04: detects log output', () => {
    const lines = Array.from({ length: 20 }, (_, i) =>
      `2025-07-14 10:${String(i).padStart(2,'0')}:00 INFO  Processing item ${i}`
    ).join('\n');
    expect(router.detect(lines).type).toBe('logs');
  });

  it('UT-05: skips short content', () => {
    expect(router.detect('hello world').type).toBe('short');
    expect(router.detect('hello world').shouldCompress).toBe(false);
  });

  it('UT-06: defaults to text', () => {
    const prose = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    expect(router.detect(prose).type).toBe('text');
  });

  it('UT-07: detects JSON object (not array)', () => {
    const obj = JSON.stringify({ key: 'value', nested: { a: 1, b: 2 }, list: [1, 2, 3], long: 'x'.repeat(60) });
    expect(router.detect(obj).type).toBe('json_object');
    expect(router.detect(obj).shouldCompress).toBe(false);
  });

  it('UT-08: uses hint override', () => {
    const result = router.detect('anything here that is long enough to pass the threshold check yes', 'json');
    expect(result.type).toBe('json');
    expect(result.shouldCompress).toBe(true);
  });

  it('UT-09: handles empty content', () => {
    expect(router.detect('').type).toBe('empty');
  });
});

// ─── SmartCrusher Tests ─────────────────────────────────────────────────
describe('SmartCrusher', () => {
  let crusher: SmartCrusher;
  beforeEach(() => { crusher = new SmartCrusher(); });

  it('UT-10: skips small array (<5 items)', () => {
    const items = [{ a: 1 }, { a: 2 }, { a: 3 }];
    expect(crusher.compress(items).skipped).toBe(true);
  });

  it('UT-11: default ratio keeps ~30%', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: i, name: `item${i}`, status: 'active', category: 'A'
    }));
    const result = crusher.compress(items);
    if (!result.skipped) {
      const output = JSON.parse(result.compressed.split('\n').slice(1).join('\n'));
      expect(output.length).toBeGreaterThanOrEqual(20);
      expect(output.length).toBeLessThanOrEqual(40);
    }
  });

  it('UT-12: field reduction removes low-entropy fields', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: i, name: `item${i}`, status: 'active', type: 'standard'
    }));
    const result = crusher.compress(items);
    expect(result.skipped).toBe(false);
    expect(result.strategy).toBe('hybrid');
    const output = JSON.parse(result.compressed.split('\n').slice(1).join('\n'));
    // Low entropy fields (status, type) should be removed
    expect(output[0]).not.toHaveProperty('status');
  });

  it('UT-13: preserveFields kept', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: i, name: `item${i}`, status: 'active', type: 'standard'
    }));
    const result = crusher.compress(items, { preserveFields: ['name'] });
    if (!result.skipped) {
      const output = JSON.parse(result.compressed.split('\n').slice(1).join('\n'));
      output.forEach((item: any) => expect(item).toHaveProperty('name'));
    }
  });

  it('UT-14: summary header format', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: i, name: `item${i}`, status: 'active', category: 'A'
    }));
    const result = crusher.compress(items);
    expect(result.compressed).toMatch(/^\[COMPRESSED: 100 items -> \d+ items \(\d+% reduction\)\]/);
  });

  it('UT-15: skips when not beneficial', () => {
    // Very small unique items - compression won't help
    const items = Array.from({ length: 5 }, (_, i) => ({ x: i }));
    expect(crusher.compress(items).skipped).toBe(true);
  });

  it('UT-16: performance < 10ms for 1000 items', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i, path: `/src/file${i}.ts`, size: Math.random() * 10000,
      language: 'typescript', hash: `hash${i}`, modified: '2025-01-01'
    }));
    const start = performance.now();
    crusher.compress(items);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('UT-19: primitive array sampling', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = crusher.compress(items);
    expect(result.skipped).toBe(false);
    expect(result.strategy).toBe('item_sampling');
  });
});

// ─── CompressionCache Tests ─────────────────────────────────────────────
describe('CompressionCache', () => {
  let cache: CompressionCache;
  beforeEach(() => { cache = new CompressionCache(100, 50); }); // Small limits for testing

  it('UT-45: skip set hit', () => {
    const content = 'x'.repeat(200);
    cache.store(content, { compressed: content, originalSize: 200, compressedSize: 200, ratio: 1, strategy: 'none', skipped: true });
    const result = cache.lookup(content);
    expect(result.hit).toBe(true);
    expect(result.source).toBe('skip_set');
  });

  it('UT-46: result cache hit', () => {
    const content = 'y'.repeat(200);
    const mockResult = { compressed: 'short', originalSize: 200, compressedSize: 5, ratio: 0.025, strategy: 'field_reduction' as const, skipped: false };
    cache.store(content, mockResult);
    const result = cache.lookup(content);
    expect(result.hit).toBe(true);
    expect(result.source).toBe('result_cache');
    expect(result.result).toEqual(mockResult);
  });

  it('UT-47: cache miss', () => {
    const result = cache.lookup('never seen before content that is long enough');
    expect(result.hit).toBe(false);
    expect(result.source).toBe('miss');
  });

  it('UT-40: skip set respects max size', () => {
    for (let i = 0; i < 110; i++) {
      cache.store(`content-${i}-${'x'.repeat(50)}`, { compressed: '', originalSize: 0, compressedSize: 0, ratio: 1, strategy: 'none', skipped: true });
    }
    expect(cache.getStats().skipSetSize).toBeLessThanOrEqual(100);
  });

  it('UT-43: cache hit < 0.1ms', () => {
    const content = 'test content for speed measurement with enough length';
    cache.store(content, { compressed: content, originalSize: 100, compressedSize: 100, ratio: 1, strategy: 'none', skipped: true });
    const start = performance.now();
    cache.lookup(content);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(0.1);
  });
});

// ─── CircuitBreaker Tests ───────────────────────────────────────────────
describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  beforeEach(() => { breaker = new CircuitBreaker(5, 100); }); // 100ms reset for testing

  it('UT-50: opens after 5 failures', () => {
    for (let i = 0; i < 5; i++) breaker.recordFailure();
    expect(breaker.allowRequest()).toBe(false);
    expect(breaker.getState().state).toBe('open');
  });

  it('UT-52: failure increments counter', () => {
    breaker.recordFailure();
    expect(breaker.getState().failures).toBe(1);
  });

  it('UT-55: success in half_open closes', async () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) breaker.recordFailure();
    // Wait for reset
    await new Promise(r => setTimeout(r, 110));
    // Should be half_open now
    expect(breaker.allowRequest()).toBe(true);
    breaker.recordSuccess();
    expect(breaker.getState().state).toBe('closed');
  });

  it('UT-56: failure in half_open reopens', async () => {
    for (let i = 0; i < 5; i++) breaker.recordFailure();
    await new Promise(r => setTimeout(r, 110));
    breaker.allowRequest(); // transitions to half_open
    breaker.recordFailure();
    expect(breaker.getState().state).toBe('open');
  });

  it('UT-57: closed state allows all', () => {
    expect(breaker.allowRequest()).toBe(true);
    expect(breaker.getState().state).toBe('closed');
  });
});

// ─── CacheAligner Tests ─────────────────────────────────────────────────
describe('CacheAligner', () => {
  let aligner: CacheAligner;
  beforeEach(() => { aligner = new CacheAligner(); });

  it('UT-30: extracts "Today is July 14, 2025"', () => {
    const result = aligner.align('You are a helpful assistant. Today is July 14, 2025. Help the user with coding.');
    expect(result.modified).toBe(true);
    expect(result.extractedDates.length).toBeGreaterThan(0);
    expect(result.prompt).toContain('{{DATE_');
  });

  it('UT-31: extracts ISO date', () => {
    const result = aligner.align('Current date: 2025-07-14. You help with tasks.');
    expect(result.modified).toBe(true);
    expect(result.extractedDates.some(d => d.value.includes('2025-07-14'))).toBe(true);
  });

  it('UT-33: skips short matches', () => {
    const result = aligner.align('Version 2.0 is the latest release of our software platform.');
    expect(result.modified).toBe(false);
  });

  it('UT-35: no dates found', () => {
    const result = aligner.align('You are an AI assistant that helps with software development tasks.');
    expect(result.modified).toBe(false);
    expect(result.extractedDates).toHaveLength(0);
  });

  it('UT-34: stable prefix across calls', () => {
    const prompt = 'Today is July 14, 2025. You are a helpful coding assistant.';
    const r1 = aligner.align(prompt);
    const r2 = aligner.align(prompt);
    // The prefix (before the suffix) should be identical
    const prefix1 = r1.prompt.split('\n\n---\n')[0];
    const prefix2 = r2.prompt.split('\n\n---\n')[0];
    expect(prefix1).toBe(prefix2);
  });
});

// ─── PBT Tests ──────────────────────────────────────────────────────────
describe('PBT — SmartCrusher invariants', () => {
  const crusher = new SmartCrusher();

  it('PBT-04: compressed <= original', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.nat(),
        name: fc.string({ minLength: 1, maxLength: 20 }),
        value: fc.float(),
        status: fc.constantFrom('active', 'inactive', 'pending'),
      }), { minLength: 10, maxLength: 50 }),
      (items) => {
        const result = crusher.compress(items);
        if (!result.skipped) {
          return result.compressedSize <= result.originalSize;
        }
        return true;
      }
    ));
  });

  it('PBT-05: preserveFields always kept', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.nat(),
        name: fc.string({ minLength: 1, maxLength: 10 }),
      }), { minLength: 10, maxLength: 50 }),
      (items) => {
        const result = crusher.compress(items, { preserveFields: ['name'] });
        if (!result.skipped) {
          const lines = result.compressed.split('\n');
          const jsonStr = lines.slice(1).join('\n');
          const output = JSON.parse(jsonStr);
          return output.every((item: any) => 'name' in item);
        }
        return true;
      }
    ));
  });

  it('PBT-06: ratio between 0 and 1', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        x: fc.nat(),
        y: fc.string({ minLength: 1, maxLength: 10 }),
      }), { minLength: 10, maxLength: 100 }),
      (items) => {
        const result = crusher.compress(items);
        return result.ratio > 0 && result.ratio <= 1;
      }
    ));
  });
});