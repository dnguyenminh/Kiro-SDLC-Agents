/**
 * Unit tests for sf-relationship-types module.
 */

import { describe, it, expect } from 'vitest';
import {
  SF_RELATIONSHIP_KINDS,
  isSfRelationship,
  getSfRelationshipLabel,
} from '../../src/sf-relationship-types.js';

describe('SF_RELATIONSHIP_KINDS', () => {
  it('should contain 7 relationship kinds', () => {
    expect(SF_RELATIONSHIP_KINDS).toHaveLength(7);
  });

  it('should include all expected kinds', () => {
    expect(SF_RELATIONSHIP_KINDS).toContain('trigger-on');
    expect(SF_RELATIONSHIP_KINDS).toContain('soql');
    expect(SF_RELATIONSHIP_KINDS).toContain('dml');
    expect(SF_RELATIONSHIP_KINDS).toContain('wire');
    expect(SF_RELATIONSHIP_KINDS).toContain('flow-action');
    expect(SF_RELATIONSHIP_KINDS).toContain('flow-object');
    expect(SF_RELATIONSHIP_KINDS).toContain('apex-import');
  });
});

describe('isSfRelationship', () => {
  it('should return true for valid SF relationship kinds', () => {
    expect(isSfRelationship('trigger-on')).toBe(true);
    expect(isSfRelationship('soql')).toBe(true);
    expect(isSfRelationship('dml')).toBe(true);
    expect(isSfRelationship('wire')).toBe(true);
    expect(isSfRelationship('flow-action')).toBe(true);
    expect(isSfRelationship('flow-object')).toBe(true);
    expect(isSfRelationship('apex-import')).toBe(true);
  });

  it('should return false for non-SF relationship kinds', () => {
    expect(isSfRelationship('imports')).toBe(false);
    expect(isSfRelationship('calls')).toBe(false);
    expect(isSfRelationship('inherits')).toBe(false);
    expect(isSfRelationship('implements')).toBe(false);
    expect(isSfRelationship('')).toBe(false);
    expect(isSfRelationship('unknown')).toBe(false);
  });
});

describe('getSfRelationshipLabel', () => {
  it('should return readable label for each kind', () => {
    expect(getSfRelationshipLabel('trigger-on')).toContain('Trigger');
    expect(getSfRelationshipLabel('soql')).toContain('SOQL');
    expect(getSfRelationshipLabel('dml')).toContain('DML');
    expect(getSfRelationshipLabel('wire')).toContain('@wire');
    expect(getSfRelationshipLabel('flow-action')).toContain('Flow');
    expect(getSfRelationshipLabel('flow-object')).toContain('Flow');
    expect(getSfRelationshipLabel('apex-import')).toContain('LWC');
  });
});
