import type { BaubleSlot, BaubleState, DamageType, EnchantEffect } from '../types';
import { BAUBLE_SLOTS } from '../types';
import { getBauble } from '../data/catalog';

// Baubles are global buffs: their numeric effects are aggregated once and fed
// into both computeWeapon and computeArmor. Protection-style effects are folded
// in here against the incoming damage type so the engines stay type-agnostic.
export interface BaubleBonuses {
  /** Flat melee damage added to every hit. */
  flatDamage: number;
  /** Best-case situational flat damage (e.g. vs undead); affects max only. */
  conditionalDamage: number;
  /** Summed +damage fraction applied to the weapon's base portion (0.15 = +15%). */
  damageMultiplierFraction: number;
  /** Summed attack-speed fraction (operation-1 style; +0.2 = +20% speed). */
  attackSpeedFraction: number;
  /** Extra Resistance levels (stacks with the potion knob, 20%/level). */
  extraResistanceLevel: number;
  /** Global protection % for the incoming damage type (capped with other layers). */
  globalProtectionPct: number;
  /** Global vanilla EPF for the incoming damage type. */
  globalEpf: number;
  /** Extra locational armor per region key (only head/body baubles grant this). */
  bonusLocationalArmor: Record<string, number>;
  /** Flat max HP added to the effective-HP baseline. */
  maxHpFlat: number;
}

export interface BaubleContribution {
  id: string;
  name: string;
  slot: BaubleSlot;
  /** Human-readable summary of the numeric effects (empty for info-only). */
  parts: string[];
}

export interface BaubleAggregate {
  bonuses: BaubleBonuses;
  contributions: BaubleContribution[];
}

// Bauble slots that map onto a First Aid body region for locational armor.
const SLOT_REGION: Partial<Record<BaubleSlot, string>> = {
  head: 'head',
  body: 'body',
};

function protectionAppliesTo(
  effectType: DamageType | undefined,
  incoming: DamageType,
): boolean {
  return effectType === undefined || effectType === incoming;
}

function emptyBonuses(): BaubleBonuses {
  return {
    flatDamage: 0,
    conditionalDamage: 0,
    damageMultiplierFraction: 0,
    attackSpeedFraction: 0,
    extraResistanceLevel: 0,
    globalProtectionPct: 0,
    globalEpf: 0,
    bonusLocationalArmor: {},
    maxHpFlat: 0,
  };
}

const pctLabel = (f: number) => `${f >= 0 ? '+' : ''}${Math.round(f * 100)}%`;

/**
 * Aggregate the equipped baubles into a single set of global bonuses. Pass the
 * incoming damage type so protection-style effects (fire resistance, etc.) are
 * only counted when they apply; omit it for weapon-only calculations.
 */
export function aggregateBaubleBonuses(
  baubles: BaubleState,
  damageType?: DamageType,
): BaubleAggregate {
  const bonuses = emptyBonuses();
  const contributions: BaubleContribution[] = [];

  for (const slot of BAUBLE_SLOTS) {
    const id = baubles[slot];
    if (!id) continue;
    const def = getBauble(id);
    if (!def) continue;

    const parts: string[] = [];
    for (const eff of def.effects) {
      applyEffect(eff, slot, damageType, bonuses, parts);
    }
    contributions.push({ id: def.id, name: def.name, slot, parts });
  }

  return { bonuses, contributions };
}

function applyEffect(
  eff: EnchantEffect,
  slot: BaubleSlot,
  damageType: DamageType | undefined,
  bonuses: BaubleBonuses,
  parts: string[],
): void {
  const v = eff.base ?? 0;
  switch (eff.kind) {
    case 'flatDamage':
      if (eff.condition) {
        bonuses.conditionalDamage += v;
        parts.push(`+${v} dmg (${eff.condition})`);
      } else {
        bonuses.flatDamage += v;
        parts.push(`+${v} dmg`);
      }
      break;
    case 'damageMultiplier':
      bonuses.damageMultiplierFraction += v;
      parts.push(`${pctLabel(v)} damage`);
      break;
    case 'attackSpeedMultiplier':
      bonuses.attackSpeedFraction += v;
      parts.push(`${pctLabel(v)} attack speed`);
      break;
    case 'resistance':
      bonuses.extraResistanceLevel += v;
      parts.push(`Resistance +${v}`);
      break;
    case 'maxHp':
      bonuses.maxHpFlat += v;
      parts.push(`+${v} max HP`);
      break;
    case 'locationalArmor': {
      const region = SLOT_REGION[slot];
      if (region) {
        bonuses.bonusLocationalArmor[region] =
          (bonuses.bonusLocationalArmor[region] ?? 0) + v;
        parts.push(`+${v} locational armor`);
      }
      break;
    }
    case 'percentReduction': {
      if (damageType && protectionAppliesTo(eff.damageType, damageType)) {
        const p = eff.perLevelPct ?? 0;
        bonuses.globalProtectionPct += p;
        parts.push(`${pctLabel(p)} ${eff.damageType ?? 'all'} reduction`);
      }
      break;
    }
    case 'vanillaProtection': {
      if (damageType && protectionAppliesTo(eff.damageType, damageType)) {
        bonuses.globalEpf += eff.epfPerLevel ?? 0;
        parts.push(`+${eff.epfPerLevel ?? 0} EPF`);
      }
      break;
    }
    default:
      break;
  }
}
