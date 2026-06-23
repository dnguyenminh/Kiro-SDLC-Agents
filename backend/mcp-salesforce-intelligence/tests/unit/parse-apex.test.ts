import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { handleParseApex } from '../../src/servers/sf-parser/tools/parse-apex.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/sfdx-project');

describe('sf_parse_apex', () => {
  it('should parse a valid Apex class', async () => {
    const result = await handleParseApex({ file_path: 'force-app/main/default/classes/AccountService.cls' }, FIXTURES);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('AccountService');
    expect(parsed.type).toBe('class');
    expect(parsed.modifiers).toContain('public');
    expect(parsed.modifiers).toContain('with sharing');
    expect(parsed.interfaces).toContain('IAccountService');
    expect(parsed.methods.length).toBeGreaterThan(0);
    expect(parsed.errors).toHaveLength(0);
  });

  it('should extract methods correctly', async () => {
    const result = await handleParseApex({ file_path: 'force-app/main/default/classes/AccountService.cls' }, FIXTURES);
    const parsed = JSON.parse(result);
    const names = parsed.methods.map((m: any) => m.name);
    expect(names).toContain('getAccounts');
    expect(names).toContain('createAccount');
    expect(names).toContain('deleteAccount');
  });

  it('should extract dependencies', async () => {
    const result = await handleParseApex({ file_path: 'force-app/main/default/classes/AccountService.cls' }, FIXTURES);
    const parsed = JSON.parse(result);
    expect(parsed.dependencies.referenced_classes).toContain('IAccountService');
    expect(parsed.dependencies.soql_queries.length).toBeGreaterThan(0);
  });

  it('should parse a trigger', async () => {
    const result = await handleParseApex({ file_path: 'force-app/main/default/triggers/AccountTrigger.trigger' }, FIXTURES);
    const parsed = JSON.parse(result);
    expect(parsed.type).toBe('trigger');
    expect(parsed.name).toBe('AccountTrigger');
    expect(parsed.trigger_info).not.toBeNull();
    expect(parsed.trigger_info.object).toBe('Account');
    expect(parsed.trigger_info.events).toContain('before insert');
  });

  it('should return error for missing file', async () => {
    const result = await handleParseApex({ file_path: 'nonexistent.cls' }, FIXTURES).catch(err => err.toJSON());
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe('SF-001');
  });

  it('should return error for unsupported file type', async () => {
    const result = await handleParseApex({ file_path: 'sfdx-project.json' }, FIXTURES).catch(err => err.toJSON());
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe('SF-002');
  });
});
