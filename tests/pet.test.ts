import { describe, expect, it } from 'vitest';
import { clampPetPosition, resolvePetActivity } from '../src/domain/pet';

describe('desktop pet rules', () => {
  it('keeps a restored or dragged window inside a display work area', () => {
    expect(
      clampPetPosition(
        { x: 2400, y: 1500 },
        { width: 280, height: 400 },
        { x: 0, y: 0, width: 1920, height: 1040 },
      ),
    ).toEqual({ x: 1640, y: 640 });
    expect(
      clampPetPosition(
        { x: -2500, y: -100 },
        { width: 280, height: 400 },
        { x: -1920, y: 0, width: 1920, height: 1080 },
      ),
    ).toEqual({ x: -1920, y: 0 });
    expect(
      clampPetPosition(
        { x: 100, y: 100 },
        { width: 350, height: 500 },
        { x: 0, y: 0, width: 300, height: 400 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });
  it('lets dragging interrupt reactions while preserving manual rest or sleep', () => {
    expect(resolvePetActivity('study', 'cheer', false)).toBe('cheer');
    expect(resolvePetActivity('sleep', 'cheer', false)).toBe('sleep');
    expect(resolvePetActivity('rest', 'hello', false)).toBe('rest');
    expect(resolvePetActivity('sleep', 'hello', true)).toBe('drag');
    expect(resolvePetActivity('study', null, false)).toBe('study');
  });
});
