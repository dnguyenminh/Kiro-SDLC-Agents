/**
 * Unit tests for sf-metadata-types module.
 */

import { describe, it, expect } from 'vitest';
import {
  SfMetadataType,
  detectMetadataType,
  getMetadataTypeLabel,
  SF_FILE_EXTENSIONS,
} from '../../src/sf-metadata-types.js';

describe('SfMetadataType enum', () => {
  it('should define all expected types', () => {
    expect(SfMetadataType.ApexClass).toBe('ApexClass');
    expect(SfMetadataType.ApexTrigger).toBe('ApexTrigger');
    expect(SfMetadataType.Flow).toBe('Flow');
    expect(SfMetadataType.CustomObject).toBe('CustomObject');
    expect(SfMetadataType.CustomField).toBe('CustomField');
    expect(SfMetadataType.LwcComponent).toBe('LwcComponent');
    expect(SfMetadataType.AuraComponent).toBe('AuraComponent');
  });
});

describe('detectMetadataType', () => {
  it('should detect Apex class files', () => {
    expect(detectMetadataType('force-app/main/default/classes/AccountService.cls')).toBe(SfMetadataType.ApexClass);
  });

  it('should detect Apex trigger files', () => {
    expect(detectMetadataType('force-app/main/default/triggers/AccountTrigger.trigger')).toBe(SfMetadataType.ApexTrigger);
  });

  it('should detect Flow metadata files', () => {
    expect(detectMetadataType('force-app/main/default/flows/Auto_Create.flow-meta.xml')).toBe(SfMetadataType.Flow);
  });

  it('should detect Object metadata files', () => {
    expect(detectMetadataType('force-app/main/default/objects/Account/Account.object-meta.xml')).toBe(SfMetadataType.CustomObject);
  });

  it('should detect Field metadata files', () => {
    expect(detectMetadataType('force-app/main/default/objects/Account/fields/Status__c.field-meta.xml')).toBe(SfMetadataType.CustomField);
  });

  it('should detect LWC metadata files', () => {
    expect(detectMetadataType('force-app/main/default/lwc/accountList/accountList.js-meta.xml')).toBe(SfMetadataType.LwcComponent);
  });

  it('should detect LWC JS files by path', () => {
    expect(detectMetadataType('force-app/main/default/lwc/accountList/accountList.js')).toBe(SfMetadataType.LwcComponent);
  });

  it('should return null for non-SF files', () => {
    expect(detectMetadataType('src/index.ts')).toBeNull();
    expect(detectMetadataType('package.json')).toBeNull();
    expect(detectMetadataType('README.md')).toBeNull();
  });

  it('should handle Windows-style paths', () => {
    expect(detectMetadataType('force-app\\main\\default\\classes\\Foo.cls')).toBe(SfMetadataType.ApexClass);
  });
});

describe('getMetadataTypeLabel', () => {
  it('should return human-readable labels', () => {
    expect(getMetadataTypeLabel(SfMetadataType.ApexClass)).toBe('Apex Class');
    expect(getMetadataTypeLabel(SfMetadataType.ApexTrigger)).toBe('Apex Trigger');
    expect(getMetadataTypeLabel(SfMetadataType.Flow)).toBe('Flow');
    expect(getMetadataTypeLabel(SfMetadataType.CustomObject)).toBe('Custom Object');
    expect(getMetadataTypeLabel(SfMetadataType.LwcComponent)).toBe('Lightning Web Component');
  });
});

describe('SF_FILE_EXTENSIONS', () => {
  it('should map file extensions to metadata types', () => {
    expect(SF_FILE_EXTENSIONS['.cls']).toBe(SfMetadataType.ApexClass);
    expect(SF_FILE_EXTENSIONS['.trigger']).toBe(SfMetadataType.ApexTrigger);
    expect(SF_FILE_EXTENSIONS['.flow-meta.xml']).toBe(SfMetadataType.Flow);
  });
});
