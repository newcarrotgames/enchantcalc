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

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'items.json');

const round2 = (n) => Math.round(n * 100) / 100;

// --- Spartan Weaponry weapon types (from spartanweaponry.cfg) ---------------
// addon = whether the modded-material addons (Spartan Fire / Defiled) register
// this weapon type (determines dragonbone/umbrium/myrmex coverage).
//
// `twoHand`, `traits`, and `cond` describe each type's Weapon Properties as
// dumped in-game (itemdumper `/dumpitems`, the "Properties:" tooltip block),
// cross-referenced against config/spartanweaponry.cfg for the magnitudes:
//   damageAbsorptionFactor=0.25  damageBonusUnarmoredMultiplier=2.0
//   damageBonusChestMultiplier=1.5  damageBonusHeadMultiplier=1.5
//   armorPiercePercentage=50  damageBonusBackstabMultiplier=2.5
// `cond` is a conditional best-case damage multiplier folded into the "max"
// (engine field `unarmoredMultiplier`): rapier = unarmored 2.0, katana = no
// chest armor 1.5. Earlier revisions mislabeled several types as having an
// "unarmored bonus"; the dump shows that trait only exists on the rapier.
const ABSORB = 'Damage Absorption: negates 25% of incoming melee damage while held (costs weapon durability).';
const WEAPONS = [
  { id: 'dagger', name: 'Dagger', base: 2.0, mult: 0.5, speed: 2.5, shape: 'dagger', addon: true,
    traits: ['Can be thrown.', 'Backstab: bonus damage when striking a foe from behind.'] },
  { id: 'throwing_knife', name: 'Throwing Knife', base: 1.5, mult: 1.0, speed: 2.5, shape: 'dagger', addon: true,
    traits: ['Can be thrown.', 'Bonus damage when thrown.'] },
  { id: 'saber', name: 'Saber', base: 3.0, mult: 0.5, speed: 1.6, shape: 'sword', addon: true,
    traits: [ABSORB, 'Chest bonus: extra damage vs foes with no chest armor.', 'Sweep: hits nearby foes.'] },
  { id: 'rapier', name: 'Rapier', base: 1.5, mult: 0.5, speed: 2.4, shape: 'rapier', addon: true,
    traits: [ABSORB], cond: { mult: 2.0, label: 'vs foes with no armor' } },
  { id: 'katana', name: 'Katana', base: 4.5, mult: 0.5, speed: 2.0, shape: 'katana', addon: true, twoHand: true,
    traits: ['Sweep: hits nearby foes.'], cond: { mult: 1.5, label: 'vs foes with no chest armor' } },
  { id: 'longsword', name: 'Longsword', base: 7.5, mult: 1.5, speed: 1.3, shape: 'sword', addon: true, twoHand: true,
    traits: ['Sweep: hits nearby foes.'] },
  { id: 'greatsword', name: 'Greatsword', base: 4.5, mult: 1.5, speed: 1.2, shape: 'greatsword', addon: true, twoHand: true,
    traits: ['Extended melee reach.', 'Sweep: hits nearby foes (wide arc).'] },
  { id: 'scythe', name: 'Scythe', base: 4.0, mult: 1.0, speed: 0.9, shape: 'polearm', addon: true, twoHand: true,
    traits: ['Wide sweep: hits foes in a wide arc.', 'Head bonus: extra damage vs foes with no helmet.'] },
  { id: 'spear', name: 'Spear', base: 5.0, mult: 0.75, speed: 1.3, shape: 'polearm', addon: true,
    traits: ['Extended melee reach.'] },
  { id: 'lance', name: 'Lance', base: 2.0, mult: 1.0, speed: 1.0, shape: 'polearm', addon: true,
    traits: ['Extended melee reach.', 'Riding bonus: extra damage while mounted.'] },
  { id: 'pike', name: 'Pike', base: 5.0, mult: 1.5, speed: 1.4, shape: 'polearm', addon: true, twoHand: true,
    traits: ['Extended melee reach.'] },
  { id: 'halberd', name: 'Halberd', base: 7.5, mult: 1.5, speed: 1.2, shape: 'polearm', addon: true, twoHand: true,
    traits: ['Extended melee reach.', 'Shield breach: can disable a blocking foe\u2019s shield.'] },
  { id: 'glaive', name: 'Glaive', base: 5.0, mult: 2.0, speed: 1.0, shape: 'polearm', addon: true, twoHand: true,
    traits: ['Extended melee reach.', 'Sweep: hits nearby foes.'] },
  { id: 'javelin', name: 'Javelin', base: 1.0, mult: 2.0, speed: 1.2, shape: 'polearm', addon: true,
    traits: ['Can be thrown.', 'Bonus damage when thrown.'] },
  { id: 'quarterstaff', name: 'Quarterstaff', base: 5.5, mult: 0.5, speed: 2.0, shape: 'polearm', addon: false, twoHand: true,
    traits: ['Sweep: hits nearby foes.'] },
  { id: 'mace', name: 'Flanged Mace', base: 3.0, mult: 1.5, speed: 1.2, shape: 'mace', addon: false },
  { id: 'hammer', name: 'Hammer', base: 7.5, mult: 0.5, speed: 0.9, shape: 'mace', addon: true,
    traits: ['Enhanced knockback.', 'Nauseous Blow: inflicts Nausea on hit unless the foe wears a helmet.'] },
  { id: 'warhammer', name: 'Warhammer', base: 6.0, mult: 1.5, speed: 1.1, shape: 'mace', addon: true, twoHand: true,
    traits: ['Armor piercing: 50% of damage ignores armor.'] },
  { id: 'battleaxe', name: 'Battleaxe', base: 7.0, mult: 2.0, speed: 1.1, shape: 'axe', addon: false, twoHand: true, axe: true,
    traits: ['Versatile: usable one- or two-handed.'] },
  { id: 'throwing_axe', name: 'Throwing Axe', base: 2.0, mult: 2.0, speed: 0.9, shape: 'axe', addon: true, axe: true,
    traits: ['Can be thrown.', 'Bonus damage when thrown.'] },
  { id: 'boomerang', name: 'Boomerang', base: 4.0, mult: 1.5, speed: 1.4, shape: 'boomerang', addon: false,
    traits: ['Can be thrown; returns to the thrower.'] },
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
  if (w.twoHand) parts.push('Two-Handed (using the offhand lowers damage and attack speed).');
  if (w.traits) parts.push(...w.traits);
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
      if (w.cond) {
        // Engine field is `unarmoredMultiplier` (folded into the crit "max").
        // The label may be unarmored (rapier) or no-chest-armor (katana).
        item.unarmoredMultiplier = w.cond.mult;
        item.unarmoredNote = `${w.cond.mult}x damage ${w.cond.label}`;
      }
      const note = buildWeaponNote(w, mat);
      if (note) item.note = note;
      items.push(item);
    }
  }
  return items;
}

// --- Nunchaku (Better Survival) ---------------------------------------------
// Nunchaku come from the Better Survival mod (mujmajnkraftsbettersurvival), NOT
// Spartan Weaponry. Better Survival weapons derive their stats from a vanilla
// sword of the same material (verified by decompiling ItemCustomWeapon):
//   attackDamage attribute = (3 + materialDamage) * damageFactor
//   attackSpeed  attribute = 4.0 + (-2.4 * delayFactor)
// The displayed per-hit damage is 1 (player base) + the attribute modifier, so
//   baseDamage  = 1 + (3 + materialDamage) * damageFactor
// From config/mujmajnkraftsbettersurvival.cfg: Nunchaku Damage Factor = 0.5,
// Attack Delay Factor = 0.36 (so nunchaku are very fast, low damage per hit).
// Material attack-damage values come from Better Survival's own materials
// (config "X Stats" 4th value) and Ice and Fire tool materials for the modded
// variants (verified by decompiling IafItemRegistry):
//   silver 1.0, copper 1.5 (IaF), dragonbone 4.0, flamed/iced/shocked 5.5,
//   myrmex chitin & stinger 1.0.
const NUNCHAKU_DAMAGE_FACTOR = 0.5;
const NUNCHAKU_DELAY_FACTOR = 0.36;
const NUNCHAKU_SPEED = round2(4.0 + -2.4 * NUNCHAKU_DELAY_FACTOR);

const NUNCHAKU_MATERIALS = [
  { key: 'wood', name: 'Wooden', dmg: 0 },
  { key: 'stone', name: 'Stone', dmg: 1 },
  { key: 'iron', name: 'Iron', dmg: 2 },
  { key: 'gold', name: 'Golden', dmg: 0 },
  { key: 'diamond', name: 'Diamond', dmg: 3 },
  { key: 'copper', name: 'Copper', dmg: 1.5 },
  { key: 'bronze', name: 'Bronze', dmg: 1.8 },
  { key: 'invar', name: 'Invar', dmg: 2.1 },
  { key: 'silver', name: 'Silver', dmg: 1.0 },
  { key: 'electrum', name: 'Electrum', dmg: 0.6 },
  { key: 'aluminium', name: 'Aluminium', dmg: 1.8 },
  { key: 'steel', name: 'Steel', dmg: 2.5 },
  { key: 'signalum', name: 'Signalum', dmg: 2.0 },
  { key: 'lumium', name: 'Lumium', dmg: 2.5 },
  { key: 'enderium', name: 'Enderium', dmg: 4.0 },
  { key: 'dragonbone', name: 'Dragonbone', dmg: 4.0 },
  { key: 'fire_dragonbone', name: 'Flamed Dragonbone', dmg: 5.5 },
  { key: 'ice_dragonbone', name: 'Iced Dragonbone', dmg: 5.5 },
  { key: 'lightning_dragonbone', name: 'Shocked Dragonbone', dmg: 5.5 },
  { key: 'desert_myrmex', name: 'Desert Myrmex Chitin', dmg: 1.0 },
  { key: 'desert_venom', name: 'Desert Myrmex Stinger', dmg: 1.0 },
  { key: 'jungle_myrmex', name: 'Jungle Myrmex Chitin', dmg: 1.0 },
  { key: 'jungle_venom', name: 'Jungle Myrmex Stinger', dmg: 1.0 },
];

function generateNunchaku() {
  return NUNCHAKU_MATERIALS.map((mat) => ({
    id: `nunchaku_${mat.key}`,
    name: `${mat.name} Nunchaku`,
    pack: 'rlcraft',
    mod: 'Better Survival',
    category: 'weapon',
    slot: 'mainhand',
    group: 'Nunchaku',
    icon: `nunchaku:${mat.key}`,
    baseDamage: round2(1 + (3 + mat.dmg) * NUNCHAKU_DAMAGE_FACTOR),
    attackSpeed: NUNCHAKU_SPEED,
    accepts: ['sword', 'weapon', 'any'],
    note:
      'Very fast, low per-hit damage. Hold attack to spin; landing consecutive spinning hits ramps the damage up.',
  }));
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

// --- Armor (derived from the in-game item dump) -----------------------------
// Every wearable armor piece in the pack comes straight from the itemdumper
// dump (itemdumps/itemdump.json in the local RLCraft Dregora install): its real
// vanilla armor points + toughness. The engine scales these into RLCraft First
// Aid "locational armor" per region (head x4+3, chest x2+3, legs x2+4,
// feet x3+3), which reproduces the wiki's published locational numbers (the
// dump even prints them in the tooltip, used as a sanity check).
//
// Pieces are grouped into sets by their in-game display name (consistent within
// a set, slot word at the end). Color variants that share an identical display
// name + stats (e.g. the ~30 Dragon Scale colors, 7 Tide Guardian colors) are
// collapsed to one entry; a small COLOR_WORDS strip also collapses differently
// named but identical color sets (e.g. Tan/White/Red Death Worm Chitin).
//
// On a machine with the local install present this refreshes the committed
// snapshot scripts/armorDump.json so regeneration stays reproducible without the
// install (mirrors how baubles are generated).

const ARMOR_DUMP =
  '/mnt/d/curseforge/minecraft/Instances/RLCraft Dregora (Local Dev)/itemdumps/itemdump.json';
const ARMOR_SNAPSHOT = join(__dirname, 'armorDump.json');
const BAUBLE_SNAPSHOT = join(__dirname, 'baublesDump.json');

const stripColor = (s) => String(s ?? '').replace(/\u00a7./g, '');

// in-game armorSlot -> our EquipSlot / icon shape.
const SLOT_OF = { head: 'helmet', chest: 'chestplate', legs: 'leggings', feet: 'boots' };

// modId -> display name (extends the bauble map for armor-only mods).
const ARMOR_MOD_NAMES = {
  minecraft: 'Minecraft',
  iceandfire: 'Ice and Fire',
  rlmixins: 'RLMixins',
  forgottenitems: 'Forgotten Items',
  defiledlands: 'Defiled Lands',
  aquaculture: 'Aquaculture',
  nuclearcraft: 'NuclearCraft',
  quark: 'Quark',
  simpledifficulty: 'Simple Difficulty',
  srparasites: 'SRParasites',
  grapplemod: 'Grappling Hook',
  variedcommodities: 'Varied Commodities',
  mod_lavacow: 'Savage & Ravage',
  bountifulbaubles: 'Bountiful Baubles',
};

// Leading variant words stripped only to collapse identical color sets. Pure
// colors only (NOT material words like copper/silver, which are distinct sets).
const COLOR_WORDS = new Set([
  'tan', 'white', 'red', 'blue', 'green', 'gray', 'grey', 'purple', 'teal',
  'deepblue', 'pink', 'orange', 'yellow', 'black', 'brown', 'cyan', 'magenta',
]);

// Trailing slot words removed from a display name to get the set name.
const SLOT_WORDS = new Set([
  'helmet', 'cap', 'hood', 'hat', 'mask', 'headwear', 'helm', 'head', 'crown',
  'chestplate', 'chestpiece', 'chest', 'tunic', 'coat', 'vest', 'torso', 'trenchcoat',
  'leggings', 'pants', 'legs', 'bottoms', 'bottom', 'skirt',
  'boots', 'boot', 'feet',
]);

// Stable, friendly ids for sets that already shipped (preserve shareable URLs)
// plus a couple of nicer slugs. Keyed by set name.
const SET_ID = {
  'Dragon Scale': 'dragonscale',
  'Desert Myrmex Chitin': 'desert_myrmex_chitin',
  'Jungle Myrmex Chitin': 'jungle_myrmex_chitin',
};

// Verified set-bonus / flavor notes kept from the previous curated catalog.
const SET_NOTES = {
  'Steel': 'Between iron and diamond. Full set: Flame Hardened (fire immunity & +50% fire resistance).',
  'Dragon Scale': 'Top dragon armor. Many color variants share these stats.',
  'Desert Myrmex Chitin': 'On par with diamond. Full set: +1 step height (Millipede).',
  'Jungle Myrmex Chitin': 'On par with diamond. Full set: +1 step height (Millipede).',
  'Golem': 'Very high armor and knockback resistance, but heavy.',
};

// Fallback SVG material color key per set name (real sprites override this when
// extractIcons.mjs finds them; the color only shows when no sprite exists, e.g.
// the Savage & Ravage / Lavacow sets whose textures are not in the jars).
const SET_MATERIAL = {
  Leather: 'leather', Chain: 'chainmail', Iron: 'iron', Golden: 'gold',
  Diamond: 'diamond', Steel: 'steel', Copper: 'copper', Silver: 'silver',
  'Dragon Scale': 'dragonbone', 'Desert Myrmex Chitin': 'desert_myrmex',
  'Jungle Myrmex Chitin': 'jungle_myrmex', Golem: 'golem', Neptunium: 'neptunium',
  Umbrium: 'umbrium', 'Book Wyrm Scale': 'bookwyrm', 'Golden Book Wyrm Scale': 'gold',
  Molten: 'molten', Famine: 'famine', Swine: 'swine', Weta: 'weta',
  'The Crown of Rule': 'gold', Scarlite: 'scarlite', 'Tide Guardian': 'tide',
};

const slug = (s) =>
  stripColor(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Remove a single leading color word (kept for collapsing color variants).
function stripColorWord(name) {
  const parts = name.split(/\s+/);
  if (parts.length > 1 && COLOR_WORDS.has(parts[0].toLowerCase())) {
    return parts.slice(1).join(' ');
  }
  return name;
}

// Derive the set name from a piece's display name: drop a leading color word,
// then a trailing slot word. Falls back to the full name when that empties it.
function setNameOf(displayName) {
  const cleaned = stripColorWord(stripColor(displayName).trim());
  const parts = cleaned.split(/\s+/);
  if (parts.length > 1 && SLOT_WORDS.has(parts[parts.length - 1].toLowerCase())) {
    return parts.slice(0, -1).join(' ');
  }
  return cleaned;
}

// Pull the in-game locational-armor tooltip line (sanity-check / note source).
function locationalLine(tooltip) {
  const l = (tooltip ?? []).map(stripColor).find((x) => /Locational Armor/i.test(x));
  return l ? l.trim().replace(/^\+?/, '') : null;
}

function loadArmorDump() {
  if (existsSync(ARMOR_DUMP)) {
    const dump = JSON.parse(readFileSync(ARMOR_DUMP, 'utf8'));
    const items = Array.isArray(dump) ? dump : dump.items ?? [];
    // Items already worn as baubles (e.g. Quark hats) are listed in the bauble
    // catalog; skip them here so they are not double-counted as helmets.
    let baubleRegs = new Set();
    if (existsSync(BAUBLE_SNAPSHOT)) {
      baubleRegs = new Set(
        JSON.parse(readFileSync(BAUBLE_SNAPSHOT, 'utf8')).map((b) => b.registryName),
      );
    }
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const slot = SLOT_OF[it.armorSlot];
      if (!slot) continue;
      if (!(it.armorPoints > 0)) continue; // skip 0-point cosmetics (lifebelt, blindfold)
      if (baubleRegs.has(it.registryName)) continue;
      if (seen.has(it.registryName)) continue;
      seen.add(it.registryName);
      out.push({
        registryName: it.registryName,
        modId: it.modId ?? it.registryName.split(':')[0],
        displayName: stripColor(it.displayName),
        slot,
        armorPoints: it.armorPoints,
        toughness: it.toughness ?? 0,
        locational: locationalLine(it.tooltip),
      });
    }
    writeFileSync(ARMOR_SNAPSHOT, JSON.stringify(out, null, 2) + '\n');
    console.log(`  Refreshed ${ARMOR_SNAPSHOT} (${out.length} armor pieces)`);
    return out;
  }
  if (existsSync(ARMOR_SNAPSHOT)) {
    const out = JSON.parse(readFileSync(ARMOR_SNAPSHOT, 'utf8'));
    console.log(`  Using committed snapshot ${ARMOR_SNAPSHOT} (${out.length} armor pieces)`);
    return out;
  }
  throw new Error(
    'No item dump and no armor snapshot found. Run /dumpitems in-game, or restore scripts/armorDump.json.',
  );
}

// Prefer the canonically-named variant when collapsing identical-stat pieces.
const CANONICAL_PIECE_WORD = new Set(['helmet', 'chestplate', 'leggings', 'boots']);
function pieceScore(p) {
  const last = stripColor(p.displayName).trim().split(/\s+/).pop().toLowerCase();
  return CANONICAL_PIECE_WORD.has(last) ? 1 : 0;
}

function generateArmorFromDump() {
  const pieces = loadArmorDump();

  // Group pieces into sets keyed by (mod, set name); color variants that share
  // a set name + stats collapse automatically.
  const sets = new Map();
  for (const p of pieces) {
    const setName = setNameOf(p.displayName);
    const key = `${p.modId}|${setName}`;
    let set = sets.get(key);
    if (!set) {
      set = { setName, modId: p.modId, pieces: {} };
      sets.set(key, set);
    }
    const existing = set.pieces[p.slot];
    if (existing) {
      if (existing.armorPoints !== p.armorPoints) {
        // Same set name + slot, different stats: keep the stronger, warn once.
        console.warn(
          `  WARN: ${setName} ${p.slot} stat conflict (${existing.armorPoints} vs ${p.armorPoints}); keeping higher`,
        );
        if (p.armorPoints <= existing.armorPoints) continue;
      } else if (pieceScore(p) <= pieceScore(existing)) {
        // Identical stats (color/cosmetic variant): keep the canonically-named
        // piece (e.g. "Mithril Leggings" over "Mithril Skirt").
        continue;
      }
    }
    set.pieces[p.slot] = p;
  }

  // Group labels must be unique per set; when two mods share a set name (e.g.
  // vanilla "Iron" vs Varied Commodities' "Iron Skirt"), suffix the mod so the
  // palette keeps them apart (vanilla keeps the bare label).
  const nameCounts = {};
  for (const set of sets.values()) {
    nameCounts[set.setName] = (nameCounts[set.setName] ?? 0) + 1;
  }
  const modName = (modId) => ARMOR_MOD_NAMES[modId] ?? modId;
  const groupLabel = (set) =>
    nameCounts[set.setName] > 1 && set.modId !== 'minecraft'
      ? `${set.setName} (${modName(set.modId)})`
      : `${set.setName} Armor`;

  // Vanilla first so it claims the clean ids (iron_helmet, ...) that tests and
  // shareable URLs rely on; modded ids fall back to a mod-prefixed form on clash.
  const ordered = [...sets.values()].sort(
    (a, b) =>
      (a.modId === 'minecraft' ? 0 : 1) - (b.modId === 'minecraft' ? 0 : 1) ||
      a.setName.localeCompare(b.setName),
  );

  const usedIds = new Set();
  const items = [];
  for (const set of ordered) {
    const { setName, modId } = set;
    const material = SET_MATERIAL[setName] ?? slug(setName);
    const note = SET_NOTES[setName];
    for (const slot of ['helmet', 'chestplate', 'leggings', 'boots']) {
      const p = set.pieces[slot];
      if (!p) continue;
      const base =
        modId === 'minecraft'
          ? p.registryName.split(':')[1] // iron_helmet, chainmail_leggings, ...
          : `${SET_ID[setName] ?? slug(setName)}_${slot}`;
      let id = base;
      if (usedIds.has(id)) id = `${slug(modId)}_${base}`;
      for (let n = 2; usedIds.has(id); n++) id = `${base}_${n}`;
      usedIds.add(id);

      const item = {
        id,
        name: stripColorWord(p.displayName),
        pack: modId === 'minecraft' ? 'vanilla' : 'rlcraft',
        category: 'armor',
        slot,
        group: groupLabel(set),
        icon: `${slot}:${material}`,
        armorPoints: p.armorPoints,
        toughness: round2(p.toughness),
        registryName: p.registryName,
        accepts: ['armor', slot, 'any'],
      };
      if (modId !== 'minecraft') item.mod = modName(modId);
      if (note) item.note = note;
      items.push(item);
    }
  }
  // Stable ordering: by group then slot.
  const slotOrder = { helmet: 0, chestplate: 1, leggings: 2, boots: 3 };
  items.sort(
    (a, b) => a.group.localeCompare(b.group) || slotOrder[a.slot] - slotOrder[b.slot],
  );
  return items;
}

const all = [
  ...VANILLA_WEAPONS,
  ...generateSpartanWeapons(),
  ...generateNunchaku(),
  ...generateArmorFromDump(),
];

writeFileSync(OUT, JSON.stringify(all, null, 2) + '\n');
console.log(`Wrote ${all.length} items to ${OUT}`);
const weapons = all.filter((i) => i.category === 'weapon').length;
const armor = all.filter((i) => i.category === 'armor').length;
console.log(`  weapons: ${weapons}, armor: ${armor}`);
