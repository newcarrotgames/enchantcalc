import { describe, it, expect } from 'vitest';
import { computeWeapon } from '../weapon';
import { getItem } from '../../data/catalog';
import type { ItemDef } from '../../types';

function item(id: string): ItemDef {
  const i = getItem(id);
  if (!i) throw new Error(`missing item ${id}`);
  return i;
}

describe('computeWeapon', () => {
  it('iron sword + Sharpness V', () => {
    // Sharpness V flat = 0.5 + 0.5*5 = 3.0
    const r = computeWeapon(item('iron_sword'), [
      { enchantId: 'sharpness', level: 5 },
    ]);
    expect(r.flatBonus).toBeCloseTo(3.0);
    expect(r.min).toBeCloseTo(9.0); // 6 + 3
    expect(r.max).toBeCloseTo(12.0); // 6*1.5 + 3
    expect(r.dpsMin).toBeCloseTo(14.4); // 9 * 1.6
  });

  it('bare iron sword has no bonus', () => {
    const r = computeWeapon(item('iron_sword'), []);
    expect(r.min).toBeCloseTo(6);
    expect(r.max).toBeCloseTo(9); // crit only
  });

  it('iron katana applies the 1.5x unarmored multiplier in the max', () => {
    // base 5.5, speed 2.0, unarmored 1.5, + Sharpness V (3.0)
    const r = computeWeapon(item('katana_iron'), [
      { enchantId: 'sharpness', level: 5 },
    ]);
    expect(r.min).toBeCloseTo(8.5); // 5.5 + 3
    // crit + unarmored: 5.5 * 1.5 * 1.5 = 12.375, + 3 = 15.375
    expect(r.max).toBeCloseTo(15.38);
  });

  it('conditional enchants (Smite) only count toward max', () => {
    const r = computeWeapon(item('diamond_sword'), [
      { enchantId: 'smite', level: 5 },
    ]);
    expect(r.flatBonus).toBeCloseTo(0);
    expect(r.conditionalBonus).toBeCloseTo(12.5); // 2.5 * 5
    expect(r.min).toBeCloseTo(7); // base only
    expect(r.max).toBeCloseTo(23); // 7*1.5 + 12.5
  });

  it('supreme sharpness V on diamond sword', () => {
    // 4 + 1.6*5 = 12
    const r = computeWeapon(item('diamond_sword'), [
      { enchantId: 'supreme_sharpness', level: 5 },
    ]);
    expect(r.flatBonus).toBeCloseTo(12);
    expect(r.min).toBeCloseTo(19); // 7 + 12
    expect(r.max).toBeCloseTo(22.5); // 7*1.5 + 12
  });
});
