import { describe, expect, it } from 'vitest';
import { auditAdsSnapshot, parseAdsSnapshot, SAMPLE_ADS_SNAPSHOT } from './adsAuditService';

describe('ads audit service', () => {
  it('creates a read-only evidence report and never an executable action', () => {
    const report = auditAdsSnapshot(parseAdsSnapshot(SAMPLE_ADS_SNAPSHOT), new Date('2026-08-02T00:00:00Z'));
    expect(report.readOnly).toBe(true);
    expect(report.findings.some((finding) => finding.id.startsWith('zero-conversions'))).toBe(true);
    expect(JSON.stringify(report)).not.toContain('accessToken');
    expect(report.generatedAt).toBe('2026-08-02T00:00:00.000Z');
  });

  it('rejects negative values and unsupported schema versions', () => {
    expect(() => parseAdsSnapshot('{"schemaVersion":"ads.snapshot.v2"}')).toThrow('ads.snapshot.v1');
    expect(() => parseAdsSnapshot(SAMPLE_ADS_SNAPSHOT.replace('"spend": 920', '"spend": -1'))).toThrow('не меньше нуля');
  });

  it('rejects ambiguous or log-forging campaign labels', () => {
    const duplicate = SAMPLE_ADS_SNAPSHOT.replace('"Generic Search"', '"Brand Search"');
    const controlCharacter = SAMPLE_ADS_SNAPSHOT.replace('"Generic Search"', '"Generic\\nSearch"');
    expect(() => parseAdsSnapshot(duplicate)).toThrow('уникальным');
    expect(() => parseAdsSnapshot(controlCharacter)).toThrow('name');
  });
});
