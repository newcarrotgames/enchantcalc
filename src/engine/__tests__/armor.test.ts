import { describe, it, expect } from 'vitest';
import { computeArmor } from '../armor';
import type { AppliedEnchant, BuildState, EquipSlot } from '../../types';

function emptyBuild(): BuildState {
  const slot = () => ({ itemId: null, enchants: [] as AppliedEnchant[] });
  return {
    mainhand: slot(),
    helmet: slot(),
    chestplate: slot(),
    leggings: slot(),
    boots: slot(),
  };
}

function withPiece(
  build: BuildState,
  slot: EquipSlot,
  itemId: string,
  enchants: AppliedEnchant[] = [],
): BuildState {
  build[slot] = { itemId, enchants };
  return build;
}

const DEFAULT_OPTS = {
  incomingDamage: 10,
  damageType: 'physical' as const,
  resistanceLevel: 0,
};

const region = (r: ReturnType<typeof computeArmor>, key: string) =>
  r.regions.find((x) => x.key === key)!;

describe('computeArmor (locational / First Aid)', () => {
  it('full diamond armor, no enchants, 10 physical', () => {
    let b = emptyBuild();
    b = withPiece(b, 'helmet', 'diamond_helmet');
    b = withPiece(b, 'chestplate', 'diamond_chestplate');
    b = withPiece(b, 'leggings', 'diamond_leggings');
    b = withPiece(b, 'boots', 'diamond_boots');

    const r = computeArmor(b, DEFAULT_OPTS);
    expect(r.totalArmorPoints).toBe(20);
    expect(r.totalToughness).toBe(8);
    // toughness 2/piece -> dmg/(2+0.5) = 4 absorbed
    // head: LA = 3*4+3 = 15 -> (15-4)/25 = 0.44
    // body: LA = 8*2+3 = 19 -> (19-4)/25 = 0.60
    // legs: LA = 6*2+4 = 16 -> (16-4)/25 = 0.48
    // feet: LA = 3*3+3 = 12 -> (12-4)/25 = 0.32
    expect(region(r, 'head').layers.armor).toBeCloseTo(0.44);
    expect(region(r, 'body').layers.armor).toBeCloseTo(0.6);
    expect(region(r, 'legs').layers.armor).toBeCloseTo(0.48);
    expect(region(r, 'feet').layers.armor).toBeCloseTo(0.32);
    // hit-weighted (1,3,2,2)/8 average reduction
    expect(r.totalReductionPct).toBeCloseTo(0.48);
  });

  it('full diamond + Protection IV: local EPF x4 -> 0.64 per region', () => {
    let b = emptyBuild();
    const prot: AppliedEnchant[] = [{ enchantId: 'protection', level: 4 }];
    b = withPiece(b, 'helmet', 'diamond_helmet', prot);
    b = withPiece(b, 'chestplate', 'diamond_chestplate', prot);
    b = withPiece(b, 'leggings', 'diamond_leggings', prot);
    b = withPiece(b, 'boots', 'diamond_boots', prot);

    const r = computeArmor(b, DEFAULT_OPTS);
    // EPF = 1*4 levels * 4 (local mult) = 16 -> 0.64
    expect(region(r, 'body').layers.protection).toBeCloseTo(0.64);
    // body remaining = (1-0.64)*(1-0.6) = 0.144
    expect(region(r, 'body').reductionPct).toBeCloseTo(0.856);
  });

  it('iron helmet + Advanced Protection IV caps that region layer at 80%', () => {
    let b = emptyBuild();
    b = withPiece(b, 'helmet', 'iron_helmet', [
      { enchantId: 'advanced_protection', level: 4 },
    ]);
    const r = computeArmor(b, DEFAULT_OPTS);
    // 0.24*4 = 0.96 capped at 0.80
    expect(region(r, 'head').layers.protection).toBeCloseTo(0.8);
  });

  it('physical protection does not reduce magic damage', () => {
    let b = emptyBuild();
    b = withPiece(b, 'chestplate', 'iron_chestplate', [
      { enchantId: 'physical_protection', level: 4 },
    ]);
    const physical = computeArmor(b, { ...DEFAULT_OPTS, damageType: 'physical' });
    const magic = computeArmor(b, { ...DEFAULT_OPTS, damageType: 'magic' });
    expect(region(physical, 'body').layers.protection).toBeCloseTo(0.8);
    expect(region(magic, 'body').layers.protection).toBeCloseTo(0);
    // armor points also do not help magic
    expect(region(magic, 'body').layers.armor).toBeCloseTo(0);
  });

  it('resistance layer applies to every region multiplicatively', () => {
    let b = emptyBuild();
    b = withPiece(b, 'chestplate', 'iron_chestplate');
    const r = computeArmor(b, { ...DEFAULT_OPTS, resistanceLevel: 2 });
    expect(region(r, 'head').layers.resistance).toBeCloseTo(0.4);
    // unarmored head still gets resistance only
    expect(region(r, 'head').reductionPct).toBeCloseTo(0.4);
  });
});
