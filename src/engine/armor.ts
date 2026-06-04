import type { BuildState, DamageType, EquipSlot } from '../types';
import { getEnchant, getItem } from '../data/catalog';

const LAYER_CAP = 0.8; // each RLCraft reduction layer is capped at 80%
const EPF_CAP = 20; // vanilla enchantment protection factor cap
const EPF_TO_PCT = 0.04; // each EPF point = 4% reduction
const DEFENSE_DIVISOR = 25; // vanilla armor: reduction = defense / 25
const VANILLA_BASE_HP = 20;

// First Aid (RLCraft) splits the body into regions, each protected by one
// armor piece. The piece's vanilla armor points are converted to "locational
// armor" for that region:  locational = vanillaArmor * multiplier + offset.
// Values from RLCraft's config/firstaid.cfg (locationalarmor section).
interface Region {
  key: string;
  label: string;
  slot: EquipSlot;
  armorMult: number;
  armorOffset: number;
  toughMult: number;
  toughOffset: number;
  weight: number; // share of incoming hits (8 limbs: head1, body+arms3, legs2, feet2)
  critical: boolean;
}

const REGIONS: Region[] = [
  { key: 'head', label: 'Head', slot: 'helmet', armorMult: 4, armorOffset: 3, toughMult: 1, toughOffset: 0, weight: 1, critical: true },
  { key: 'body', label: 'Body / Arms', slot: 'chestplate', armorMult: 2, armorOffset: 3, toughMult: 1, toughOffset: 0, weight: 3, critical: true },
  { key: 'legs', label: 'Legs', slot: 'leggings', armorMult: 2, armorOffset: 4, toughMult: 1, toughOffset: 0, weight: 2, critical: false },
  { key: 'feet', label: 'Feet', slot: 'boots', armorMult: 3, armorOffset: 3, toughMult: 1, toughOffset: 0, weight: 2, critical: false },
];
const TOTAL_WEIGHT = REGIONS.reduce((n, r) => n + r.weight, 0); // 8

// First Aid LOCAL_ENCHANTMENTS mode scales a single piece's vanilla protection
// enchant so it matches vanilla's 4-piece balance. Default x4, with per-enchant
// overrides from firstaid.cfg (enchantmenthandling.overrideentries).
const ENCHANT_MULT: Record<string, number> = {
  protection: 4,
  projectile_protection: 2,
  blast_protection: 2,
  fire_protection: 2,
};

export interface RegionResult {
  key: string;
  label: string;
  slot: EquipSlot;
  itemName: string | null;
  armorPoints: number;
  toughness: number;
  locationalArmor: number;
  protectionName: string | null;
  protectionLevel: number;
  layers: { resistance: number; protection: number; armor: number };
  reductionPct: number;
  remaining: number;
  damageTaken: number;
  critical: boolean;
}

export interface ArmorResult {
  regions: RegionResult[];
  layers: { resistance: number; protection: number; armor: number }; // hit-weighted summary
  totalReductionPct: number; // hit-weighted
  effectiveHP: number;
  totalArmorPoints: number;
  totalToughness: number;
}

export interface ArmorOptions {
  incomingDamage: number;
  damageType: DamageType;
  resistanceLevel: number; // 0..5 (Resistance potion)
  baseHP?: number;
}

// Armor points mitigate physical, projectile and blast damage, but not raw
// magic or fire-tick damage (those rely on the matching protection enchant).
function armorAppliesTo(type: DamageType): boolean {
  return type === 'physical' || type === 'projectile' || type === 'blast';
}

function protectionAppliesTo(
  enchantType: DamageType | undefined,
  incoming: DamageType,
): boolean {
  return enchantType === undefined || enchantType === incoming;
}

/**
 * RLCraft locational (First Aid) armor model. For each body region:
 *   1. The covering piece's vanilla armor points are scaled into "locational
 *      armor" for that region, then the vanilla armor formula (with toughness)
 *      gives an armor reduction (capped 80%).
 *   2. Protection enchants on that piece (local enchantment mode) give a
 *      protection reduction (vanilla EPF x local multiplier + RLCraft %),
 *      capped 80%.
 *   3. Resistance applies globally (20%/level, capped 80%).
 * Layers combine multiplicatively. Overall figures are hit-weighted across the
 * regions (chestplate covers body + both arms, so it carries the most weight).
 */
export function computeArmor(build: BuildState, opts: ArmorOptions): ArmorResult {
  const baseHP = opts.baseHP ?? VANILLA_BASE_HP;
  const dmg = Math.max(0.0001, opts.incomingDamage);
  const resistanceLayer = Math.min(LAYER_CAP, 0.2 * opts.resistanceLevel);

  let totalArmorPoints = 0;
  let totalToughness = 0;
  const regions: RegionResult[] = [];

  for (const region of REGIONS) {
    const item = getItem(build[region.slot].itemId);
    const armorPoints = item?.armorPoints ?? 0;
    const toughness = item?.toughness ?? 0;
    totalArmorPoints += armorPoints;
    totalToughness += toughness;

    const hasPiece = !!item && armorPoints > 0;
    const locationalArmor = hasPiece
      ? armorPoints * region.armorMult + region.armorOffset
      : 0;
    const locationalToughness = hasPiece
      ? toughness * region.toughMult + region.toughOffset
      : 0;

    // Layer: locational armor + toughness (vanilla formula).
    let armorLayer = 0;
    if (hasPiece && armorAppliesTo(opts.damageType)) {
      const defense = Math.min(
        EPF_CAP,
        Math.max(
          locationalArmor / 5,
          locationalArmor - dmg / (2 + locationalToughness / 4),
        ),
      );
      armorLayer = Math.min(LAYER_CAP, defense / DEFENSE_DIVISOR);
    }

    // Layer: protection enchants on this piece only (local mode).
    let epf = 0;
    let pct = 0;
    let protectionName: string | null = null;
    let protectionLevel = 0;
    for (const a of build[region.slot].enchants) {
      const def = getEnchant(a.enchantId);
      if (!def) continue;
      if (def.effect.kind === 'vanillaProtection') {
        if (!protectionAppliesTo(def.effect.damageType, opts.damageType)) continue;
        const mult = ENCHANT_MULT[def.id] ?? 4;
        epf += (def.effect.epfPerLevel ?? 0) * a.level * mult;
        protectionName = def.name;
        protectionLevel = a.level;
      } else if (def.effect.kind === 'percentReduction') {
        if (!protectionAppliesTo(def.effect.damageType, opts.damageType)) continue;
        pct += (def.effect.perLevelPct ?? 0) * a.level;
        protectionName = def.name;
        protectionLevel = a.level;
      }
    }
    const protectionLayer = Math.min(
      LAYER_CAP,
      Math.min(EPF_CAP, epf) * EPF_TO_PCT + pct,
    );

    const remaining =
      (1 - resistanceLayer) * (1 - protectionLayer) * (1 - armorLayer);

    regions.push({
      key: region.key,
      label: region.label,
      slot: region.slot,
      itemName: item?.name ?? null,
      armorPoints,
      toughness,
      locationalArmor: round1(locationalArmor),
      protectionName,
      protectionLevel,
      layers: {
        resistance: resistanceLayer,
        protection: protectionLayer,
        armor: armorLayer,
      },
      reductionPct: 1 - remaining,
      remaining,
      damageTaken: round2(dmg * remaining),
      critical: region.critical,
    });
  }

  // Hit-weighted summary across regions.
  const weightedRemaining = regions.reduce(
    (sum, r, i) => sum + r.remaining * (REGIONS[i].weight / TOTAL_WEIGHT),
    0,
  );
  const wAvg = (pick: (r: RegionResult) => number) =>
    regions.reduce((s, r, i) => s + pick(r) * (REGIONS[i].weight / TOTAL_WEIGHT), 0);

  return {
    regions,
    layers: {
      resistance: resistanceLayer,
      protection: wAvg((r) => r.layers.protection),
      armor: wAvg((r) => r.layers.armor),
    },
    totalReductionPct: 1 - weightedRemaining,
    effectiveHP: weightedRemaining > 0 ? round1(baseHP / weightedRemaining) : Infinity,
    totalArmorPoints,
    totalToughness,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
