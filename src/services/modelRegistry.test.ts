import { describe, expect, it } from 'vitest';
import { hardwareStatus, MODEL_REGISTRY, recommendModel } from './modelRegistry';

describe('model registry', () => {
  it('fails closed when hardware is below the declared minimum', () => {
    expect(hardwareStatus(MODEL_REGISTRY[0], { ramGb: 8, vramGb: 4, diskGb: 100 })).toBe('missing');
  });

  it('does not recommend an unlicensed placeholder', () => {
    expect(recommendModel('audio', false, { ramGb: 64, vramGb: 24, diskGb: 500 })).toBeNull();
  });
});
