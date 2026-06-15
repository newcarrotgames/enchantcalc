// Shared domain types for the RLCraft enchant calculator.

export type Pack = 'vanilla' | 'rlcraft' | 'dregora';

export type ItemCategory = 'weapon' | 'armor';

export type EquipSlot =
  | 'mainhand'
  | 'offhand'
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
  // Registry id from the in-game dump (e.g. "iceandfire:armor_red_helmet"),
  // for armor derived from the dump. Used for icon extraction / cross-ref.
  registryName?: string;

  accepts: EnchantTag[];
  note?: string;
}

export type EnchantEffectKind =
  | 'flatDamage' // adds flat melee damage per hit (Sharpness family, Smite, ...)
  | 'attackSpeedMultiplier' // scales the weapon's attack speed (Swifter Slashes, Heavy Weight)
  | 'percentReduction' // RLCraft custom % reduction per level (capped)
  | 'vanillaProtection' // EPF-based vanilla protection
  | 'dot' // damage over time after a hit (Fire Aspect family, Envenomed)
  // Bauble-only effect kinds (unused by enchants, but share the EnchantEffect
  // shape so the engine can consume both; baubles fix the level at 1).
  | 'damageMultiplier' // scales the weapon's base damage by a fraction (base = +0.15 => +15%)
  | 'locationalArmor' // adds flat locational armor to the region matching the bauble's slot
  | 'resistance' // adds Resistance levels (like the potion), 20%/level
  | 'maxHp' // adds flat max HP (raises effective-HP baseline)
  | 'info'; // listed but not modelled numerically (chance-based, cosmetic)

// Kind of damage-over-time an enchant inflicts on the target after a hit.
export type DotType = 'fire' | 'poison' | 'wither';

export interface EnchantEffect {
  kind: EnchantEffectKind;

  // flatDamage: damage = base + perLevel * level
  // attackSpeedMultiplier: speed bonus fraction = base + perLevel * level
  //   (e.g. +0.2/level -> effective attack speed x(1 + 0.2 * level)); may be negative.
  base?: number;
  perLevel?: number;

  // percentReduction: reduction = min(cap, perLevelPct * level)
  perLevelPct?: number;
  cap?: number;

  // vanillaProtection: enchantment protection factor added per level
  epfPerLevel?: number;

  // dot: estimated damage-over-time the target takes after being hit.
  //   estimated total (if it lands) = base + perLevel * level, unless
  //   dotDamageByLevel is given (1-indexed by level) for non-linear effects.
  dotType?: DotType;
  dotDamageByLevel?: number[]; // overrides base/perLevel when present
  dotChancePerLevel?: number; // probability per level it applies (default 1 = always)
  dotRandom?: boolean; // per-hit roll varies 0..max (Lesser Fire Aspect)
  dotCanKill?: boolean; // false = caps the target at 1 HP (poison)
  dotSecondsBase?: number; // display: effect duration = base + perLevel * level
  dotSecondsPerLevel?: number;
  dotNote?: string; // extra caveat shown in the breakdown

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

// --- Baubles ---------------------------------------------------------------
// RLCraft's Baubles mod adds 7 accessory slots. A bauble declares a
// `baubleType`; a `ring` fits either ring slot, and an `any`-type bauble fits
// any of the 7 slots. Baubles can't be enchanted, so they have no enchant list.
export type BaubleSlotType =
  | 'amulet'
  | 'ring'
  | 'belt'
  | 'head'
  | 'body'
  | 'charm'
  | 'any';

export type BaubleSlot =
  | 'amulet'
  | 'ring1'
  | 'ring2'
  | 'belt'
  | 'head'
  | 'body'
  | 'charm';

export const BAUBLE_SLOTS: BaubleSlot[] = [
  'amulet',
  'ring1',
  'ring2',
  'belt',
  'head',
  'body',
  'charm',
];

export interface BaubleDef {
  id: string;
  name: string;
  pack: Pack;
  mod?: string;
  // Registry id from the in-game dump (e.g. "bountifulbaubles:amuletsinwrath").
  // Used for icon extraction and cross-referencing against the dump.
  registryName: string;
  baubleType: BaubleSlotType;
  icon: string;
  group?: string;
  // A bauble may grant several effects at once; [] = pure-info (searchable only).
  effects: EnchantEffect[];
  description: string;
  source: string;
}

// Equipped bauble id per slot (null = empty). Baubles carry no enchants.
export type BaubleState = Record<BaubleSlot, string | null>;
