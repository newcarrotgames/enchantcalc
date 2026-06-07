import type { AppliedEnchant, ItemDef } from '../types';
import { getEnchant } from '../data/catalog';

export interface WeaponContribution {
  enchantId: string;
  name: string;
  level: number;
  flat: number;
  conditional: boolean;
  condition?: string;
}

export interface SpeedContribution {
  enchantId: string;
  name: string;
  level: number;
  /** Signed fraction added to the attack-speed multiplier (e.g. +1.0 = +100%). */
  deltaFraction: number;
}

export interface DotContribution {
  enchantId: string;
  name: string;
  level: number;
  type: 'fire' | 'poison' | 'wither';
  /** Lowest estimated DoT damage this hit (0 if it can whiff / roll low). */
  min: number;
  /** Highest estimated DoT damage when the effect lands in full. */
  max: number;
  /** Probability-weighted estimate (max x chance), for chance-based effects. */
  expected: number;
  /** Chance the effect applies on a hit (1 = always). */
  chance: number;
  /** Effect duration in seconds, for display. */
  seconds: number;
  /** False when the effect can't kill (poison caps the target at 1 HP). */
  canKill: boolean;
  note?: string;
}

export interface WeaponResult {
  baseDamage: number;
  /** The weapon's intrinsic attack speed (attacks/second), before enchants. */
  attackSpeed: number;
  /** Attack speed after attack-speed enchants (Swifter Slashes, Heavy Weight). */
  effectiveAttackSpeed: number;
  /** Multiplier applied to attackSpeed by enchants (1 = no change). */
  attackSpeedMultiplier: number;
  /** Total flat damage from enchants that always apply. */
  flatBonus: number;
  /** Best-case extra flat damage from situational enchants (e.g. Smite vs undead). */
  conditionalBonus: number;
  unarmoredMultiplier: number;
  unarmoredNote?: string;
  /** Lowest expected per-hit damage: no crit, no situational bonuses. */
  min: number;
  /** Highest per-hit damage: crit + situational + unarmored multiplier. */
  max: number;
  dpsMin: number;
  dpsMax: number;
  contributions: WeaponContribution[];
  speedContributions: SpeedContribution[];
  /** Per-enchant damage-over-time estimates (fire, poison, wither). */
  dots: DotContribution[];
  /** Total best-case DoT damage that can land in full (sum of dot.max). */
  dotMax: number;
  /** Probability-weighted total DoT damage (sum of dot.expected). */
  dotExpected: number;
}

const CRIT_MULTIPLIER = 1.5;

/**
 * Minecraft 1.12 / RLCraft melee order: base damage, then x1.5 on a critical
 * hit, then flat enchant damage is added (Sharpness etc. are not multiplied by
 * crit). Modded weapon multipliers (e.g. katana 1.5x vs no chestplate) scale
 * the weapon portion. The result is expressed as a min-max range:
 *   min = no crit, no situational bonus, no unarmored multiplier
 *   max = crit + best situational bonus + unarmored multiplier (if any)
 */
export function computeWeapon(item: ItemDef, applied: AppliedEnchant[]): WeaponResult {
  const baseDamage = item.baseDamage ?? 0;
  const attackSpeed = item.attackSpeed ?? 0;

  let flatBonus = 0;
  let conditionalBonus = 0;
  // Attack-speed enchants are vanilla "operation 1" modifiers on the speed
  // attribute: each adds (baseSpeed * amount), so their amounts sum and apply
  // once as speed x (1 + sum). Swifter Slashes & Heavy Weight are mutually
  // exclusive in RLCraft, but summing keeps us faithful if that ever changes.
  let speedAmountSum = 0;
  const contributions: WeaponContribution[] = [];
  const speedContributions: SpeedContribution[] = [];
  const dots: DotContribution[] = [];

  for (const a of applied) {
    const def = getEnchant(a.enchantId);
    if (!def) continue;

    if (def.effect.kind === 'dot') {
      dots.push(computeDot(def.id, def.name, a.level, def.effect));
      continue;
    }

    if (def.effect.kind === 'flatDamage') {
      const { base = 0, perLevel = 0, condition } = def.effect;
      const flat = base + perLevel * a.level;
      const conditional = Boolean(condition);
      if (conditional) {
        conditionalBonus += flat;
      } else {
        flatBonus += flat;
      }
      contributions.push({
        enchantId: def.id,
        name: def.name,
        level: a.level,
        flat,
        conditional,
        condition,
      });
    } else if (def.effect.kind === 'attackSpeedMultiplier') {
      const { base = 0, perLevel = 0 } = def.effect;
      const deltaFraction = base + perLevel * a.level;
      speedAmountSum += deltaFraction;
      speedContributions.push({
        enchantId: def.id,
        name: def.name,
        level: a.level,
        deltaFraction,
      });
    }
  }

  const unarmoredMultiplier = item.unarmoredMultiplier ?? 1;
  // Attack speed cannot drop below zero in-game.
  const attackSpeedMultiplier = Math.max(0, 1 + speedAmountSum);
  const effectiveAttackSpeed = attackSpeed * attackSpeedMultiplier;

  // Real damage is clamped to >= 0 (relevant for the Bluntness curse).
  const min = Math.max(0, baseDamage + flatBonus);
  const critWeaponPart = baseDamage * CRIT_MULTIPLIER * unarmoredMultiplier;
  const max = Math.max(0, critWeaponPart + flatBonus + conditionalBonus);

  const dotMax = dots.reduce((sum, d) => sum + d.max, 0);
  const dotExpected = dots.reduce((sum, d) => sum + d.expected, 0);

  return {
    baseDamage,
    attackSpeed,
    effectiveAttackSpeed: round2(effectiveAttackSpeed),
    attackSpeedMultiplier,
    flatBonus,
    conditionalBonus,
    unarmoredMultiplier,
    unarmoredNote: item.unarmoredNote,
    min: round2(min),
    max: round2(max),
    dpsMin: round2(min * effectiveAttackSpeed),
    dpsMax: round2(max * effectiveAttackSpeed),
    contributions,
    speedContributions,
    dots,
    dotMax: round2(dotMax),
    dotExpected: round2(dotExpected),
  };
}

/**
 * Estimate the damage-over-time a single enchant inflicts after a hit. These
 * are deliberately kept out of the per-hit min/max range: DoT damage ticks over
 * time, doesn't crit, isn't scaled by attack speed, and is often situational
 * (fire-immune mobs, poison capping the target at 1 HP, chance to apply).
 *
 * Values are derived from the So Many Enchantments source (see generateEnchants).
 */
function computeDot(
  enchantId: string,
  name: string,
  level: number,
  effect: import('../types').EnchantEffect,
): DotContribution {
  const {
    dotType = 'fire',
    dotDamageByLevel,
    base = 0,
    perLevel = 0,
    dotChancePerLevel,
    dotRandom = false,
    dotCanKill = true,
    dotSecondsBase = 0,
    dotSecondsPerLevel = 0,
    dotNote,
  } = effect;

  const full = dotDamageByLevel
    ? dotDamageByLevel[level - 1] ?? 0
    : base + perLevel * level;
  const max = Math.max(0, full);
  // Lesser Fire Aspect rolls 0..max each hit; otherwise the floor is the full
  // amount (a clean, deterministic tick total).
  const min = dotRandom ? 0 : max;
  const chance =
    dotChancePerLevel != null ? Math.min(1, dotChancePerLevel * level) : 1;
  // Expected value folds in both the apply chance and the 0..max roll.
  const rollMean = dotRandom ? (min + max) / 2 : max;
  const expected = rollMean * chance;
  const seconds = dotSecondsBase + dotSecondsPerLevel * level;

  return {
    enchantId,
    name,
    level,
    type: dotType,
    min: round2(min),
    max: round2(max),
    expected: round2(expected),
    chance,
    seconds: round2(seconds),
    canKill: dotCanKill,
    note: dotNote,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
