/**
 * Unit tests for token-counter utility.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countTokens, fitsInBudget, truncateToFit } from '../token-counter.js';

describe('countTokens', () => {
  it('should return 0 for empty string', () => {
    assert.equal(countTokens(''), 0);
  });

  it('should approximate tokens as chars/4', () => {
    assert.equal(countTokens('abcd'), 1);
    assert.equal(countTokens('abcdefgh'), 2);
    assert.equal(countTokens('a'.repeat(100)), 25);
  });

  it('should ceil fractional tokens', () => {
    assert.equal(countTokens('abc'), 1); // 3/4 = 0.75 → ceil = 1
    assert.equal(countTokens('abcde'), 2); // 5/4 = 1.25 → ceil = 2
  });
});

describe('fitsInBudget', () => {
  it('should return true when within budget', () => {
    assert.equal(fitsInBudget('hello', 10), true);
  });

  it('should return false when over budget', () => {
    assert.equal(fitsInBudget('a'.repeat(100), 10), false);
  });
});

describe('truncateToFit', () => {
  it('should return original if within budget', () => {
    assert.equal(truncateToFit('hello world', 100), 'hello world');
  });

  it('should truncate at word boundary', () => {
    const text = 'hello world this is a test';
    const result = truncateToFit(text, 3); // 12 chars max
    assert(result.length <= 16); // 12 + "..."
    assert(result.endsWith('...'));
  });
});
