import { describe, it, expect } from 'vitest';
import { aggregateBaubleBonuses } from '../baubles';
import { computeWeapon } from '../weapon';
import { computeArmor } from '../armor';
import { baubleFitsSlot, getBauble, getItem } from '../../data/catalog';
import { emptyBaubles, emptyBuild, deserialize, serialize } from '../../store/urlState';
import type { BaubleState, BuildState } from '../../types';

const POWER_GLOVE = 'bauble_artifacts_power_glove'; // +3 melee damage
const FERAL_CLAWS = 'bauble_artifacts_feral_claws'; // +20% attack speed
const WRATH = 'bauble_bountifulbaubles_amuletsinwrath'; // +2 melee damage
const WITCH_HAT = 'bauble_quark_witch_hat'; // +7 locational armor (head)
const OBSIDIAN_SKULL = 'bauble_bountifulbaubles_trinketobsidianskull'; // 50% fire

const region = (r: ReturnType<typeof computeArmor>, key: string) =>
  r.regions.find((x) => x.key === key)!;

describe('bauble catalog + slot fit', () => {
  it('catalog has the verified combat baubles', () => {
    for (const id of [POWER_GLOVE, FERAL_CLAWS, WRATH, WITCH_HAT, OBSIDIAN_SKULL]) {
      expect(getBauble(id)).toBeDefined();
    }
  });

  it('ring fits either ring slot but not amulet; any fits all; amulet matches', () => {
    const ring = getBauble(POWER_GLOVE)!; // ring
    expect(baubleFitsSlot(ring, 'ring1')).toBe(true);
    expect(baubleFitsSlot(ring, 'ring2')).toBe(true);
    expect(baubleFitsSlot(ring, 'amulet')).toBe(false);

    const any = getBauble(OBSIDIAN_SKULL)!; // any
    expect(baubleFitsSlot(any, 'amulet')).toBe(true);
    expect(baubleFitsSlot(any, 'charm')).toBe(true);

    const amulet = getBauble(WRATH)!;
    expect(baubleFitsSlot(amulet, 'amulet')).toBe(true);
    expect(baubleFitsSlot(amulet, 'ring1')).toBe(false);
  });
});

describe('aggregateBaubleBonuses', () => {
  it('sums flat damage and attack speed across slots', () => {
    const baubles: BaubleState = { ...emptyBaubles(), ring1: POWER_GLOVE, ring2: FERAL_CLAWS };
    const { bonuses } = aggregateBaubleBonuses(baubles);
    expect(bonuses.flatDamage).toBe(3);
    expect(bonuses.attackSpeedFraction).toBeCloseTo(0.2);
  });

  it('locational armor maps a head bauble to the head region only', () => {
    const baubles: BaubleState = { ...emptyBaubles(), head: WITCH_HAT };
    const { bonuses } = aggregateBaubleBonuses(baubles);
    expect(bonuses.bonusLocationalArmor.head).toBe(7);
    expect(bonuses.bonusLocationalArmor.body).toBeUndefined();
  });

  it('fire reduction only counts when incoming damage is fire', () => {
    const baubles: BaubleState = { ...emptyBaubles(), amulet: OBSIDIAN_SKULL };
    expect(aggregateBaubleBonuses(baubles, 'fire').bonuses.globalProtectionPct).toBeCloseTo(0.5);
    expect(aggregateBaubleBonuses(baubles, 'physical').bonuses.globalProtectionPct).toBe(0);
  });
});

describe('computeWeapon with bauble bonuses', () => {
  it('Power Glove adds +3 flat damage to min and max', () => {
    const sword = getItem('iron_sword')!;
    const base = computeWeapon(sword, []);
    const { bonuses } = aggregateBaubleBonuses({ ...emptyBaubles(), ring1: POWER_GLOVE });
    const withGlove = computeWeapon(sword, [], bonuses);
    expect(withGlove.min).toBeCloseTo(base.min + 3);
    expect(withGlove.max).toBeCloseTo(base.max + 3);
  });

  it('Feral Claws scale effective attack speed by +20%', () => {
    const sword = getItem('iron_sword')!;
    const { bonuses } = aggregateBaubleBonuses({ ...emptyBaubles(), ring1: FERAL_CLAWS });
    const r = computeWeapon(sword, [], bonuses);
    expect(r.effectiveAttackSpeed).toBeCloseTo(sword.attackSpeed! * 1.2);
  });
});

describe('computeArmor with bauble bonuses', () => {
  it('Witch Hat grants head reduction with no helmet equipped', () => {
    const build: BuildState = emptyBuild();
    const opts = { incomingDamage: 10, damageType: 'physical' as const, resistanceLevel: 0 };
    const bare = computeArmor(build, opts);
    expect(region(bare, 'head').reductionPct).toBe(0);

    const { bonuses } = aggregateBaubleBonuses({ ...emptyBaubles(), head: WITCH_HAT });
    const r = computeArmor(build, opts, bonuses);
    // LA = 7 -> max(7/5, 7 - 10/2) = 2 -> 2/25 = 0.08
    expect(region(r, 'head').locationalArmor).toBe(7);
    expect(region(r, 'head').reductionPct).toBeGreaterThan(0);
  });
});

describe('URL serialization round-trips baubles', () => {
  it('preserves equipped baubles through serialize/deserialize', () => {
    const state = {
      build: emptyBuild(),
      baubles: { ...emptyBaubles(), ring1: POWER_GLOVE, head: WITCH_HAT } as BaubleState,
      scenario: { incomingDamage: 10, damageType: 'physical' as const, resistanceLevel: 0 },
    };
    const parsed = deserialize(serialize(state));
    expect(parsed).not.toBeNull();
    expect(parsed!.baubles.ring1).toBe(POWER_GLOVE);
    expect(parsed!.baubles.head).toBe(WITCH_HAT);
    expect(parsed!.baubles.ring2).toBeNull();
  });
});
