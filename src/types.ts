// Shared domain types for the RLCraft enchant calculator.

export type Pack = 'vanilla' | 'rlcraft' | 'dregora';

export type ItemCategory = 'weapon' | 'armor';

export type EquipSlot =
  | 'mainhand'
  | 'helmet'
  | 'chestplate'
  | 'leggings'
  | 'boots';

export const ARMOR_SLOTS: EquipSlot[] = [
  'helmet',
  'chestplate',
  'leggings',
  'boots',
];

// First Aid (RLCraft) damage types relevant to mitigation.
export type DamageType = 'physical' | 'projectile' | 'magic' | 'blast' | 'fire';

// Tags used to match an enchant to an item. An enchant applies to an item
// when the enchant's `appliesTo` intersects the item's `accepts`.
export type EnchantTag =
  | 'any'
  | 'weapon'
  | 'sword'
  | 'axe'
  | 'bow'
  | 'tool'
  | 'shield'
  | 'armor'
  | 'helmet'
  | 'chestplate'
  | 'leggings'
  | 'boots';

export interface ItemDef {
  id: string;
  name: string;
  pack: Pack;
  mod?: string;
  category: ItemCategory;
  slot: EquipSlot;
  icon: string;
  // Display grouping for the palette (e.g. "Katana", "Iron Armor").
  group?: string;

  // Weapon stats (per-hit attack damage attribute + attacks per second).
  baseDamage?: number;
  attackSpeed?: number;
  // Conditional multiplier some modded weapons have, e.g. katana 1.5x vs a
  // target with no chestplate. Surfaced in the "max" damage estimate.
  unarmoredMultiplier?: number;
  unarmoredNote?: string;

  // Armor stats (per piece).
  armorPoints?: number;
  toughness?: number;

  accepts: EnchantTag[];
  note?: string;
}

export type EnchantEffectKind =
  | 'flatDamage' // adds flat melee damage per hit (Sharpness family, Smite, ...)
  | 'percentReduction' // RLCraft custom % reduction per level (capped)
  | 'vanillaProtection' // EPF-based vanilla protection
  | 'info'; // listed but not modelled numerically (DoT, chance-based, cosmetic)

export interface EnchantEffect {
  kind: EnchantEffectKind;

  // flatDamage: damage = base + perLevel * level
  base?: number;
  perLevel?: number;

  // percentReduction: reduction = min(cap, perLevelPct * level)
  perLevelPct?: number;
  cap?: number;

  // vanillaProtection: enchantment protection factor added per level
  epfPerLevel?: number;

  // Restricts the effect to a damage type (protections) or situation (flatDamage).
  damageType?: DamageType;
  condition?: string; // human-readable, e.g. "vs undead"
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'veryRare' | 'na';

export interface EnchantDef {
  id: string;
  name: string;
  pack: Pack;
  mod?: string;
  maxLevel: number;
  rarity: Rarity;
  appliesTo: EnchantTag[];
  effect: EnchantEffect;
  // Enchants sharing any group id are mutually exclusive on one item.
  incompatibleGroups: string[];
  description: string;
  source: string;
}

// An enchant applied to an item at a chosen level.
export interface AppliedEnchant {
  enchantId: string;
  level: number;
}

export interface SlotState {
  itemId: string | null;
  enchants: AppliedEnchant[];
}

export type BuildState = Record<EquipSlot, SlotState>;
