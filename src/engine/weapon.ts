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

export interface WeaponResult {
  baseDamage: number;
  attackSpeed: number;
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
  const contributions: WeaponContribution[] = [];

  for (const a of applied) {
    const def = getEnchant(a.enchantId);
    if (!def || def.effect.kind !== 'flatDamage') continue;
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
  }

  const unarmoredMultiplier = item.unarmoredMultiplier ?? 1;

  const min = baseDamage + flatBonus;
  const critWeaponPart = baseDamage * CRIT_MULTIPLIER * unarmoredMultiplier;
  const max = critWeaponPart + flatBonus + conditionalBonus;

  return {
    baseDamage,
    attackSpeed,
    flatBonus,
    conditionalBonus,
    unarmoredMultiplier,
    unarmoredNote: item.unarmoredNote,
    min: round2(min),
    max: round2(max),
    dpsMin: round2(min * attackSpeed),
    dpsMax: round2(max * attackSpeed),
    contributions,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
