// Generates src/data/items.json for the RLCraft enchant calculator.
//
// Weapon stats come straight from the RLCraft Dregora config
// (config/spartanweaponry.cfg). Spartan Weaponry damage is:
//     attackDamage = damageMultiplier * materialBaseDamage + weaponDamageBase
// attack speed = the weapon type's `speed` (melee weapons) / `meleeSpeed`.
//
// Material base damages: vanilla tool materials + the native metal values
// from the config `materials` block + modded materials derived from the wiki
// katana table (base = (katanaDamage - 4.5) / 0.5), which match the config
// exactly where they overlap (silver 1.5, steel 2.5, bronze 2.0, ...).
//
// Re-run with:  node scripts/generateItems.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'items.json');

const round2 = (n) => Math.round(n * 100) / 100;

// --- Spartan Weaponry weapon types (from spartanweaponry.cfg) ---------------
// addon = whether the modded-material addons (Spartan Fire / Defiled) register
// this weapon type (determines dragonbone/umbrium/myrmex coverage).
const WEAPONS = [
  { id: 'dagger', name: 'Dagger', base: 2.0, mult: 0.5, speed: 2.5, shape: 'dagger', addon: true },
  { id: 'throwing_knife', name: 'Throwing Knife', base: 1.5, mult: 1.0, speed: 2.5, shape: 'dagger', addon: true, twoHand: false },
  { id: 'saber', name: 'Saber', base: 3.0, mult: 0.5, speed: 1.6, shape: 'sword', addon: true, unarmoredNote: true },
  { id: 'rapier', name: 'Rapier', base: 1.5, mult: 0.5, speed: 2.4, shape: 'rapier', addon: true, unarmored: 2.0 },
  { id: 'katana', name: 'Katana', base: 4.5, mult: 0.5, speed: 2.0, shape: 'katana', addon: true, twoHand: true, unarmored: 1.5 },
  { id: 'longsword', name: 'Longsword', base: 7.5, mult: 1.5, speed: 1.3, shape: 'sword', addon: true, twoHand: true, unarmoredNote: true },
  { id: 'greatsword', name: 'Greatsword', base: 4.5, mult: 1.5, speed: 1.2, shape: 'greatsword', addon: true, twoHand: true, unarmoredNote: true },
  { id: 'scythe', name: 'Scythe', base: 4.0, mult: 1.0, speed: 0.9, shape: 'polearm', addon: true },
  { id: 'spear', name: 'Spear', base: 5.0, mult: 0.75, speed: 1.3, shape: 'polearm', addon: true, twoHand: true },
  { id: 'lance', name: 'Lance', base: 2.0, mult: 1.0, speed: 1.0, shape: 'polearm', addon: true },
  { id: 'pike', name: 'Pike', base: 5.0, mult: 1.5, speed: 1.4, shape: 'polearm', addon: true, twoHand: true },
  { id: 'halberd', name: 'Halberd', base: 7.5, mult: 1.5, speed: 1.2, shape: 'polearm', addon: true, twoHand: true },
  { id: 'glaive', name: 'Glaive', base: 5.0, mult: 2.0, speed: 1.0, shape: 'polearm', addon: true, twoHand: true, unarmoredNote: true },
  { id: 'javelin', name: 'Javelin', base: 1.0, mult: 2.0, speed: 1.2, shape: 'polearm', addon: true },
  { id: 'quarterstaff', name: 'Quarterstaff', base: 5.5, mult: 0.5, speed: 2.0, shape: 'polearm', addon: false, twoHand: true, unarmoredNote: true },
  { id: 'mace', name: 'Flanged Mace', base: 3.0, mult: 1.5, speed: 1.2, shape: 'mace', addon: false },
  { id: 'hammer', name: 'Hammer', base: 7.5, mult: 0.5, speed: 0.9, shape: 'mace', addon: true, twoHand: true },
  { id: 'warhammer', name: 'Warhammer', base: 6.0, mult: 1.5, speed: 1.1, shape: 'mace', addon: true, twoHand: true },
  { id: 'battleaxe', name: 'Battleaxe', base: 7.0, mult: 2.0, speed: 1.1, shape: 'axe', addon: false, twoHand: true, axe: true },
  { id: 'throwing_axe', name: 'Throwing Axe', base: 2.0, mult: 2.0, speed: 0.9, shape: 'axe', addon: true, axe: true },
  { id: 'boomerang', name: 'Boomerang', base: 4.0, mult: 1.5, speed: 1.4, shape: 'boomerang', addon: false },
];

// --- Materials --------------------------------------------------------------
const MATERIALS = [
  { key: 'wood', name: 'Wooden', base: 0, vanilla: true },
  { key: 'stone', name: 'Stone', base: 1, vanilla: true },
  { key: 'iron', name: 'Iron', base: 2, vanilla: true },
  { key: 'gold', name: 'Golden', base: 0, vanilla: true },
  { key: 'diamond', name: 'Diamond', base: 3, vanilla: true },
  // Native Spartan Weaponry metals (config `materials` block)
  { key: 'copper', name: 'Copper', base: 1.5, mod: 'Spartan Weaponry' },
  { key: 'tin', name: 'Tin', base: 1.75, mod: 'Spartan Weaponry' },
  { key: 'bronze', name: 'Bronze', base: 2.0, mod: 'Spartan Weaponry' },
  { key: 'steel', name: 'Steel', base: 2.5, mod: 'Spartan Weaponry', trait: '+2 damage vs Nether mobs & Fire elementals' },
  { key: 'silver', name: 'Silver', base: 1.5, mod: 'Spartan Weaponry', trait: '+50% damage vs undead' },
  { key: 'invar', name: 'Invar', base: 2.2, mod: 'Spartan Weaponry' },
  { key: 'platinum', name: 'Platinum', base: 3.5, mod: 'Spartan Weaponry' },
  { key: 'electrum', name: 'Electrum', base: 2.0, mod: 'Spartan Weaponry' },
  { key: 'nickel', name: 'Nickel', base: 2.0, mod: 'Spartan Weaponry' },
  { key: 'lead', name: 'Lead', base: 2.0, mod: 'Spartan Weaponry' },
  // Modded materials (addon-only coverage)
  { key: 'umbrium', name: 'Umbrium', base: 2.0, mod: 'Spartan Defiled', addon: true },
  { key: 'dragonbone', name: 'Dragonbone', base: 4.0, mod: 'Spartan Fire', addon: true },
  { key: 'fire_dragonbone', name: 'Flamed Dragonbone', base: 5.5, mod: 'Spartan Fire', addon: true },
  { key: 'ice_dragonbone', name: 'Iced Dragonbone', base: 5.5, mod: 'Spartan Fire', addon: true },
  { key: 'lightning_dragonbone', name: 'Shocked Dragonbone', base: 5.5, mod: 'Spartan Fire', addon: true },
  { key: 'desert_myrmex', name: 'Desert Myrmex', base: -1.0, mod: 'Spartan Fire', addon: true },
  { key: 'jungle_myrmex', name: 'Jungle Myrmex', base: -1.0, mod: 'Spartan Fire', addon: true },
  { key: 'desert_venom', name: 'Desert Myrmex Stinger', base: -1.0, mod: 'Spartan Fire', addon: true },
  { key: 'jungle_venom', name: 'Jungle Myrmex Stinger', base: -1.0, mod: 'Spartan Fire', addon: true },
];

function buildWeaponNote(w, mat) {
  const parts = [];
  if (w.twoHand) parts.push('Two-Handed (mining fatigue if offhand is used).');
  if (w.unarmoredNote && !w.unarmored) parts.push('Has an unarmored damage bonus vs unarmored targets.');
  if (mat.trait) parts.push(mat.trait + '.');
  return parts.join(' ') || undefined;
}

function generateSpartanWeapons() {
  const items = [];
  for (const w of WEAPONS) {
    for (const mat of MATERIALS) {
      if (mat.addon && !w.addon) continue; // modded material not registered for this type
      const damage = round2(w.mult * mat.base + w.base);
      if (damage <= 0) continue;
      const accepts = w.axe
        ? ['axe', 'sword', 'weapon', 'any']
        : ['sword', 'weapon', 'any'];
      const item = {
        id: `${w.id}_${mat.key}`,
        name: `${mat.name} ${w.name}`,
        pack: 'rlcraft',
        mod: mat.mod ?? 'Spartan Weaponry',
        category: 'weapon',
        slot: 'mainhand',
        group: w.name,
        icon: `${w.shape}:${mat.key}`,
        baseDamage: damage,
        attackSpeed: w.speed,
        accepts,
      };
      if (w.unarmored) {
        item.unarmoredMultiplier = w.unarmored;
        item.unarmoredNote = `${w.unarmored}x damage vs unarmored targets`;
      }
      const note = buildWeaponNote(w, mat);
      if (note) item.note = note;
      items.push(item);
    }
  }
  return items;
}

// --- Vanilla weapons --------------------------------------------------------
const VANILLA_WEAPONS = [
  { id: 'fist', name: 'Fist', icon: 'fist:default', baseDamage: 1, attackSpeed: 4, accepts: [], group: 'Unarmed', note: 'Bare hand. No enchants.' },
  { id: 'wooden_sword', name: 'Wooden Sword', icon: 'sword:wood', baseDamage: 4, attackSpeed: 1.6, accepts: ['sword', 'weapon', 'any'] },
  { id: 'stone_sword', name: 'Stone Sword', icon: 'sword:stone', baseDamage: 5, attackSpeed: 1.6, accepts: ['sword', 'weapon', 'any'] },
  { id: 'iron_sword', name: 'Iron Sword', icon: 'sword:iron', baseDamage: 6, attackSpeed: 1.6, accepts: ['sword', 'weapon', 'any'] },
  { id: 'golden_sword', name: 'Golden Sword', icon: 'sword:gold', baseDamage: 4, attackSpeed: 1.6, accepts: ['sword', 'weapon', 'any'] },
  { id: 'diamond_sword', name: 'Diamond Sword', icon: 'sword:diamond', baseDamage: 7, attackSpeed: 1.6, accepts: ['sword', 'weapon', 'any'] },
  { id: 'wooden_axe', name: 'Wooden Axe', icon: 'axe:wood', baseDamage: 7, attackSpeed: 0.8, accepts: ['axe', 'weapon', 'any'] },
  { id: 'stone_axe', name: 'Stone Axe', icon: 'axe:stone', baseDamage: 9, attackSpeed: 0.8, accepts: ['axe', 'weapon', 'any'] },
  { id: 'iron_axe', name: 'Iron Axe', icon: 'axe:iron', baseDamage: 9, attackSpeed: 0.9, accepts: ['axe', 'weapon', 'any'] },
  { id: 'golden_axe', name: 'Golden Axe', icon: 'axe:gold', baseDamage: 7, attackSpeed: 1.0, accepts: ['axe', 'weapon', 'any'] },
  { id: 'diamond_axe', name: 'Diamond Axe', icon: 'axe:diamond', baseDamage: 9, attackSpeed: 1.0, accepts: ['axe', 'weapon', 'any'] },
].map((w) => ({
  pack: 'vanilla',
  category: 'weapon',
  slot: 'mainhand',
  group: w.group ?? (w.icon.startsWith('axe') ? 'Vanilla Axe' : 'Vanilla Sword'),
  ...w,
}));

// --- Vanilla armor ----------------------------------------------------------
// [helmet, chestplate, leggings, boots] armor points; toughness applies to all.
const ARMOR_SETS = [
  { key: 'leather', name: 'Leather', points: [1, 3, 2, 1], toughness: 0 },
  { key: 'golden', name: 'Golden', points: [2, 5, 3, 1], toughness: 0 },
  { key: 'chainmail', name: 'Chainmail', points: [2, 5, 4, 1], toughness: 0 },
  { key: 'iron', name: 'Iron', points: [2, 6, 5, 2], toughness: 0 },
  { key: 'diamond', name: 'Diamond', points: [3, 8, 6, 3], toughness: 2 },
];

const ARMOR_PIECES = [
  { slot: 'helmet', label: 'Helmet', icon: 'helmet' },
  { slot: 'chestplate', label: 'Chestplate', icon: 'chestplate' },
  { slot: 'leggings', label: 'Leggings', icon: 'leggings' },
  { slot: 'boots', label: 'Boots', icon: 'boots' },
];

function generateArmor() {
  const items = [];
  for (const set of ARMOR_SETS) {
    ARMOR_PIECES.forEach((piece, idx) => {
      items.push({
        id: `${set.key}_${piece.slot}`,
        name: `${set.name} ${piece.label}`,
        pack: 'vanilla',
        category: 'armor',
        slot: piece.slot,
        group: `${set.name} Armor`,
        icon: `${piece.icon}:${set.key}`,
        armorPoints: set.points[idx],
        toughness: set.toughness,
        accepts: ['armor', piece.slot, 'any'],
      });
    });
  }
  return items;
}

// Notable modded armor on the vanilla armor-point scale. The engine scales
// these into RLCraft First Aid "locational armor" per body region
// (head x4+3, chest x2+3, legs x2+4, feet x3+3), which reproduces the wiki's
// published locational numbers. `points` is [helmet, chestplate, leggings,
// boots]; null = that piece does not exist for the set.
// NOTE: Dragonsteel armor does NOT exist in RLCraft. The pack ships the
// "I&F: RLCraft Edition" fork of Ice and Fire (verified in the local install,
// Ice and Fire-2.0.9.jar), which has no dragonsteel items. Dragon Scale is the
// top dragon armor. Values are back-derived from the wiki's locational numbers.
const MODDED_ARMOR = [
  // Steel (RLMixins): locational 15/17/16/12, no toughness -> vanilla 3/7/6/3.
  { key: 'steel', name: 'Steel', mod: 'RLMixins', color: 'steel', points: [3, 7, 6, 3], toughness: 0, note: 'Between iron and diamond. Full set: Flame Hardened (fire immunity & +50% fire resistance).' },
  // Dragon Scale: locational 19/21/18/15, toughness 2 -> vanilla 4/9/7/4.
  { key: 'dragonscale', name: 'Dragon Scale', mod: 'Ice and Fire', color: 'dragonbone', points: [4, 9, 7, 4], toughness: 2, note: 'Top dragon armor; locational armor 19/21/18/15. Many color variants share these stats.' },
  // Myrmex Chitin: full 4-piece set, locational 19/19/14/12 -> vanilla 4/8/5/3.
  { key: 'desert_myrmex_chitin', name: 'Desert Myrmex Chitin', mod: 'Ice and Fire', color: 'desert_myrmex', points: [4, 8, 5, 3], toughness: 0, note: 'On par with diamond. Full set: +1 step height (Millipede).' },
  { key: 'jungle_myrmex_chitin', name: 'Jungle Myrmex Chitin', mod: 'Ice and Fire', color: 'jungle_myrmex', points: [4, 8, 5, 3], toughness: 0, note: 'On par with diamond. Full set: +1 step height (Millipede).' },
];

function generateModdedArmor() {
  const items = [];
  for (const set of MODDED_ARMOR) {
    ARMOR_PIECES.forEach((piece, idx) => {
      const pts = set.points[idx];
      if (pts == null) return;
      items.push({
        id: `${set.key}_${piece.slot}`,
        name: `${set.name} ${piece.label}`,
        pack: 'rlcraft',
        mod: set.mod,
        category: 'armor',
        slot: piece.slot,
        group: `${set.name} Armor`,
        icon: `${piece.icon}:${set.color}`,
        armorPoints: pts,
        toughness: set.toughness,
        accepts: ['armor', piece.slot, 'any'],
        note: set.note,
      });
    });
  }
  return items;
}

const all = [
  ...VANILLA_WEAPONS,
  ...generateSpartanWeapons(),
  ...generateArmor(),
  ...generateModdedArmor(),
];

writeFileSync(OUT, JSON.stringify(all, null, 2) + '\n');
console.log(`Wrote ${all.length} items to ${OUT}`);
const weapons = all.filter((i) => i.category === 'weapon').length;
const armor = all.filter((i) => i.category === 'armor').length;
console.log(`  weapons: ${weapons}, armor: ${armor}`);
