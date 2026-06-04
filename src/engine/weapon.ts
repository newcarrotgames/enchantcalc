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

  for (const a of applied) {
    const def = getEnchant(a.enchantId);
    if (!def) continue;

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
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
