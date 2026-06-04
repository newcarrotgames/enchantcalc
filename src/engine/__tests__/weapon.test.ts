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

  it('Swifter Slashes V doubles attack speed and DPS', () => {
    // x(1 + 0.2*5) = x2.0 on the weapon attack speed.
    const r = computeWeapon(item('diamond_sword'), [
      { enchantId: 'swifter_slashes', level: 5 },
    ]);
    expect(r.attackSpeedMultiplier).toBeCloseTo(2.0);
    expect(r.effectiveAttackSpeed).toBeCloseTo(3.2); // 1.6 * 2
    expect(r.min).toBeCloseTo(7); // per-hit damage unchanged
    expect(r.dpsMin).toBeCloseTo(22.4); // 7 * 3.2
    expect(r.speedContributions).toHaveLength(1);
  });

  it('Heavy Weight V greatly reduces attack speed', () => {
    // x(1 - (0.2 + 0.1*5)) = x0.3
    const r = computeWeapon(item('iron_sword'), [
      { enchantId: 'heavy_weight', level: 5 },
    ]);
    expect(r.attackSpeedMultiplier).toBeCloseTo(0.3);
    expect(r.dpsMin).toBeCloseTo(6 * 1.6 * 0.3); // 2.88
  });

  it('Bluntness V reduces per-hit damage and clamps DPS at zero', () => {
    const r = computeWeapon(item('wooden_sword'), [
      { enchantId: 'bluntness', level: 5 },
    ]);
    expect(r.flatBonus).toBeCloseTo(-5);
    expect(r.min).toBeCloseTo(0); // 4 - 5 clamped to 0
    expect(r.dpsMin).toBeCloseTo(0);
  });

  it('iron nunchaku is fast with low per-hit damage', () => {
    // baseDamage = 1 + (3 + 2) * 0.5 = 3.5, speed = 4 - 2.4*0.36 = 3.14
    const r = computeWeapon(item('nunchaku_iron'), []);
    expect(r.baseDamage).toBeCloseTo(3.5);
    expect(r.attackSpeed).toBeCloseTo(3.14);
  });
});
