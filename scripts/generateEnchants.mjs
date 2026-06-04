// Generates src/data/enchants.json.
//
// Combat enchants (damage + damage reduction) are encoded with real formulas
// so they drive the calculator. Everything else from the RLCraft wiki is
// included as searchable "info" entries (utility, curses, chance/DoT effects).
//
// Sources:
//   So Many Enchantments / RLCraft:  https://rlcraft.wiki.gg/wiki/Enchanting
//   Incompatibilities:               https://rlcraft.wiki.gg/wiki/Incompatible_Enchantments
//   Vanilla:                         https://minecraft.wiki/w/Enchanting
//
// Re-run with:  node scripts/generateEnchants.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'enchants.json');

const SME = 'https://rlcraft.wiki.gg/wiki/Enchanting';
const MC = 'https://minecraft.wiki/w/Enchanting';

// effect builders -----------------------------------------------------------
const dmg = (base, perLevel, condition) => ({
  kind: 'flatDamage',
  base,
  perLevel,
  ...(condition ? { condition } : {}),
});
const pct = (perLevelPct, damageType) => ({
  kind: 'percentReduction',
  perLevelPct,
  cap: 0.8,
  ...(damageType ? { damageType } : {}),
});
const epf = (epfPerLevel, damageType) => ({
  kind: 'vanillaProtection',
  epfPerLevel,
  ...(damageType ? { damageType } : {}),
});
const info = (condition) => ({ kind: 'info', ...(condition ? { condition } : {}) });

const MELEE = ['melee_damage'];
const PROT = ['protection'];

// [id, name, maxLevel, appliesTo, effect, opts]
// opts: { pack, mod, rarity, groups, src, desc }
const raw = [
  // ---- Vanilla weapon ----
  ['sharpness', 'Sharpness', 5, ['sword', 'axe'], dmg(0.5, 0.5), { pack: 'vanilla', mod: 'Minecraft', rarity: 'common', groups: MELEE, src: MC, desc: 'Increases melee damage. +(0.5 + 0.5 x Level).' }],
  ['smite', 'Smite', 5, ['sword', 'axe'], dmg(0, 2.5, 'vs undead'), { pack: 'vanilla', mod: 'Minecraft', rarity: 'uncommon', groups: MELEE, src: MC, desc: 'Extra damage to undead. +(2.5 x Level).' }],
  ['bane_of_arthropods', 'Bane of Arthropods', 5, ['sword', 'axe'], dmg(0, 2.5, 'vs arthropods'), { pack: 'vanilla', mod: 'Minecraft', rarity: 'uncommon', groups: MELEE, src: MC, desc: 'Extra damage to arthropods. +(2.5 x Level).' }],
  ['knockback', 'Knockback', 2, ['sword'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'uncommon', src: MC, desc: 'Increases knockback dealt.' }],
  ['fire_aspect', 'Fire Aspect', 2, ['sword'], info('burn damage over time'), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', groups: ['fire_aspect'], src: MC, desc: 'Sets the target on fire (burn damage over time, not counted per hit).' }],
  ['looting', 'Looting', 3, ['sword'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', src: MC, desc: 'Increases mob loot.' }],

  // ---- Vanilla armor ----
  ['protection', 'Protection', 4, ['armor'], epf(1), { pack: 'vanilla', mod: 'Minecraft', rarity: 'common', groups: PROT, src: MC, desc: 'Reduces most damage. +1 EPF per level.' }],
  ['projectile_protection', 'Projectile Protection', 4, ['armor'], epf(2, 'projectile'), { pack: 'vanilla', mod: 'Minecraft', rarity: 'uncommon', groups: PROT, src: MC, desc: 'Reduces projectile damage. +2 EPF per level.' }],
  ['blast_protection', 'Blast Protection', 4, ['armor'], epf(2, 'blast'), { pack: 'vanilla', mod: 'Minecraft', rarity: 'uncommon', groups: PROT, src: MC, desc: 'Reduces explosion damage. +2 EPF per level.' }],
  ['fire_protection', 'Fire Protection', 4, ['armor'], epf(2, 'fire'), { pack: 'vanilla', mod: 'Minecraft', rarity: 'common', groups: PROT, src: MC, desc: 'Reduces fire damage. +2 EPF per level.' }],
  ['feather_falling', 'Feather Falling', 4, ['boots'], info('reduces fall damage'), { pack: 'vanilla', mod: 'Minecraft', rarity: 'uncommon', groups: ['feather_falling'], src: MC, desc: 'Reduces fall damage only.' }],
  ['thorns', 'Thorns', 3, ['armor'], info('reflects damage'), { pack: 'vanilla', mod: 'Minecraft', rarity: 'veryRare', src: MC, desc: 'Chance to reflect damage to attackers.' }],
  ['respiration', 'Respiration', 3, ['helmet'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', src: MC, desc: 'Extends underwater breathing.' }],
  ['aqua_affinity', 'Aqua Affinity', 1, ['helmet'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', src: MC, desc: 'Increases underwater mining speed.' }],
  ['depth_strider', 'Depth Strider', 3, ['boots'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', groups: ['boots_water'], src: MC, desc: 'Increases underwater movement speed.' }],
  ['frost_walker', 'Frost Walker', 2, ['boots'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', groups: ['boots_water'], src: MC, desc: 'Freezes water into ice as you walk.' }],

  // ---- Vanilla bow ----
  ['power', 'Power', 5, ['bow'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'common', src: MC, desc: 'Increases arrow damage.' }],
  ['punch', 'Punch', 2, ['bow'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', src: MC, desc: 'Increases arrow knockback.' }],
  ['flame', 'Flame', 1, ['bow'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', groups: ['flame'], src: MC, desc: 'Arrows set targets on fire.' }],
  ['infinity', 'Infinity', 1, ['bow'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'veryRare', src: MC, desc: 'Arrows are not consumed.' }],

  // ---- Vanilla tools / universal ----
  ['unbreaking', 'Unbreaking', 3, ['any'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'uncommon', src: MC, desc: 'Increases durability.' }],
  ['mending', 'Mending', 1, ['any'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', src: MC, desc: 'Repairs the item using XP.' }],
  ['efficiency', 'Efficiency', 5, ['tool'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'common', src: MC, desc: 'Increases mining speed.' }],
  ['fortune', 'Fortune', 3, ['tool'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'rare', src: MC, desc: 'Increases block drops.' }],
  ['silk_touch', 'Silk Touch', 1, ['tool'], info(), { pack: 'vanilla', mod: 'Minecraft', rarity: 'veryRare', src: MC, desc: 'Mined blocks drop themselves.' }],

  // ---- So Many Enchantments: Sharpness / Smite / Bane tiers (damage) ----
  ['lesser_sharpness', 'Lesser Sharpness', 5, ['sword'], dmg(0.25, 0.25), { rarity: 'common', groups: MELEE, desc: 'Weakest tier of Sharpness. +(0.25 + 0.25 x Level).' }],
  ['advanced_sharpness', 'Advanced Sharpness', 5, ['sword', 'axe'], dmg(1.25, 0.95), { rarity: 'rare', groups: MELEE, desc: 'Advanced Sharpness. +(1.25 + 0.95 x Level).' }],
  ['supreme_sharpness', 'Supreme Sharpness', 5, ['sword'], dmg(4, 1.6), { rarity: 'veryRare', groups: MELEE, desc: 'Strongest tier of Sharpness. +(4 + 1.6 x Level).' }],
  ['lesser_smite', 'Lesser Smite', 5, ['sword'], dmg(0, 1.25, 'vs undead'), { rarity: 'common', groups: MELEE, desc: 'Weakest tier of Smite. +(1.25 x Level) vs undead.' }],
  ['advanced_smite', 'Advanced Smite', 5, ['sword', 'axe'], dmg(0, 3.25, 'vs undead'), { rarity: 'rare', groups: MELEE, desc: 'Advanced Smite. +(3.25 x Level) vs undead.' }],
  ['supreme_smite', 'Supreme Smite', 5, ['sword'], dmg(0, 5, 'vs undead'), { rarity: 'veryRare', groups: MELEE, desc: 'Strongest tier of Smite. +(5 x Level) vs undead.' }],
  ['lesser_bane', 'Lesser Bane of Arthropods', 5, ['sword', 'axe'], dmg(0, 1.25, 'vs arthropods'), { rarity: 'common', groups: MELEE, desc: 'Weakest tier of Bane. +(1.25 x Level) vs arthropods.' }],
  ['advanced_bane', 'Advanced Bane of Arthropods', 5, ['sword', 'axe'], dmg(0, 3.25, 'vs arthropods'), { rarity: 'veryRare', groups: MELEE, desc: 'Advanced Bane. +(3.25 x Level) vs arthropods.' }],
  ['supreme_bane', 'Supreme Bane of Arthropods', 5, ['sword'], dmg(0, 5, 'vs arthropods'), { rarity: 'veryRare', groups: MELEE, desc: 'Strongest tier of Bane. +(5 x Level) vs arthropods.' }],
  ['reinforced_sharpness', 'Reinforced Sharpness', 5, ['axe', 'tool'], dmg(0.5, 0.5), { rarity: 'rare', groups: MELEE, desc: 'Sharpness for tools. +(0.5 + 0.5 x Level).' }],

  // ---- So Many Enchantments: conditional damage (mutually exclusive w/ Sharpness) ----
  ['butchering', 'Butchering', 5, ['sword'], dmg(1.25, 1.25, 'vs animals'), { rarity: 'rare', groups: MELEE, desc: 'Extra damage to animals. +(1.25 + 1.25 x Level).' }],
  ['ash_destroyer', 'Ash Destroyer', 5, ['sword'], dmg(1, 0.2, 'vs burning targets'), { rarity: 'rare', groups: MELEE, desc: 'Extra damage if the target is on fire. +(1 + 0.2 x Level).' }],
  ['dark_shadows', 'Dark Shadows', 3, ['sword'], dmg(0, 0.75, 'in darkness'), { rarity: 'rare', groups: MELEE, desc: 'Extra damage in the dark. +(0.75 x Level); applies Blindness at level 3.' }],
  ['defusing_edge', 'Defusing Edge', 5, ['sword'], dmg(0, 2, 'vs creepers'), { rarity: 'rare', groups: MELEE, desc: 'Extra damage to Creepers. +(2 x Level); chance to defuse.' }],
  ['inhumane', 'Inhumane', 5, ['sword'], dmg(0, 2.5, 'vs illagers'), { rarity: 'rare', groups: MELEE, desc: 'Extra damage to Illagers. +(2.5 x Level).' }],
  ['spell_breaker', 'Spell Breaker', 5, ['sword', 'axe'], dmg(0, 1.5, 'vs magic mobs'), { rarity: 'rare', groups: MELEE, desc: 'Extra damage to magic mobs. +(1.5 x Level), +0.5 x Level per status effect.' }],
  ['subject_english', 'Subject English', 4, ['sword'], dmg(0.8, 0.3, 'vs smart mobs'), { rarity: 'rare', groups: MELEE, desc: 'Extra damage to smart mobs. +(0.8 + 0.3 x Level), plus up to 12 vs certain mobs.' }],
  ['water_aspect', 'Water Aspect', 5, ['sword'], dmg(0, 2.5, 'vs blaze/enderman/magma/submerged'), { rarity: 'rare', groups: MELEE, desc: 'Bonus vs Blaze, Endermen, Magma Cubes and submerged targets. +(2.5 x Level).' }],
  ['penetrating_edge', 'Penetrating Edge', 6, ['axe'], info('more damage vs high-armor targets'), { rarity: 'rare', desc: 'Enemies with more armor take more damage.' }],

  // ---- So Many Enchantments: armor protection (real math) ----
  ['advanced_protection', 'Advanced Protection', 4, ['armor'], pct(0.24), { rarity: 'veryRare', groups: PROT, desc: 'Reduces all damage by (Level x 24%), max 80%.' }],
  ['physical_protection', 'Physical Protection', 4, ['armor'], pct(0.24, 'physical'), { rarity: 'rare', groups: PROT, desc: 'Reduces physical damage by (Level x 24%), max 80%.' }],
  ['magic_protection', 'Magic Protection', 4, ['armor'], pct(0.24, 'magic'), { rarity: 'uncommon', groups: PROT, desc: 'Reduces magic damage by (Level x 24%), max 80%.' }],
  ['advanced_projectile_protection', 'Advanced Projectile Protection', 4, ['armor'], pct(0.24, 'projectile'), { rarity: 'rare', groups: PROT, desc: 'Reduces projectile damage by (Level x 24%), max 80%.' }],

  // ---- So Many Enchantments: other armor / info ----
  ['advanced_thorns', 'Advanced Thorns', 3, ['armor'], info('reflects damage'), { rarity: 'rare', desc: 'Stronger Thorns.' }],
  ['burning_thorns', 'Burning Thorns', 3, ['armor'], info('reflects + ignites attacker'), { rarity: 'veryRare', desc: 'When attacked, damages and ignites the attacker.' }],
  ['advanced_feather_falling', 'Advanced Feather Falling', 4, ['boots'], info('reduces fall damage'), { rarity: 'veryRare', groups: ['feather_falling'], desc: 'Reduces fall damage by (Level x 20%).' }],
  ['advanced_fire_protection', 'Advanced Fire Protection', 4, ['armor'], info('reduces fire'), { rarity: 'veryRare', desc: 'Stronger fire protection.' }],
  ['advanced_blast_protection', 'Advanced Blast Protection', 4, ['armor'], info('explosion resistance'), { rarity: 'rare', desc: 'Grants explosion resistance scaled by level.' }],
  ['curse_of_vulnerability', 'Curse of Vulnerability', 4, ['armor'], info('amplifies damage taken'), { rarity: 'veryRare', desc: 'Curse: amplifies damage taken.' }],
  ['evasion', 'Evasion', 1, ['leggings'], info('chance to dodge'), { rarity: 'rare', desc: 'Chance to evade attacks.' }],
  ['inner_berserk', 'Inner Berserk', 4, ['chestplate'], info('more damage at low HP'), { rarity: 'veryRare', desc: 'Increases damage dealt as your health lowers.' }],
  ['strengthened_vitality', 'Strengthened Vitality', 5, ['chestplate'], info('increases max health'), { rarity: 'veryRare', desc: 'Increases your maximum health.' }],
  ['meltdown', 'Meltdown', 2, ['chestplate'], info('explodes when hit'), { rarity: 'veryRare', desc: 'Chance to explode when attacked (no terrain/player damage).' }],

  // ---- So Many Enchantments: weapon utility / effects (info) ----
  ['critical_strike', 'Critical Strike', 4, ['sword'], info('chance-based extra damage'), { rarity: 'rare', desc: 'Chance to deal extra damage based on attack damage.' }],
  ['lifesteal', 'Lifesteal', 2, ['sword'], info('heals on hit'), { rarity: 'rare', desc: 'Heals you based on damage dealt.' }],
  ['envenomed', 'Envenomed', 3, ['sword'], info('applies poison/wither'), { rarity: 'rare', desc: 'Applies poison and wither.' }],
  ['fiery_edge', 'Fiery Edge', 2, ['sword'], info('extended fire'), { rarity: 'veryRare', groups: ['fire_aspect'], desc: 'Sets enemies on fire for longer; can bypass iframes.' }],
  ['lesser_fire_aspect', 'Lesser Fire Aspect', 2, ['sword'], info('burn over time'), { rarity: 'common', groups: ['fire_aspect'], desc: 'Weakest tier of Fire Aspect.' }],
  ['advanced_fire_aspect', 'Advanced Fire Aspect', 2, ['sword'], info('burn over time'), { rarity: 'rare', groups: ['fire_aspect'], desc: 'Advanced Fire Aspect.' }],
  ['supreme_fire_aspect', 'Supreme Fire Aspect', 2, ['sword'], info('burn over time'), { rarity: 'veryRare', groups: ['fire_aspect'], desc: 'Strongest Fire Aspect.' }],
  ['freezing', 'Freezing', 3, ['sword'], info('slows / mining fatigue'), { rarity: 'veryRare', desc: 'Applies Mining Fatigue and Slowness, stacking per hit.' }],
  ['levitator', 'Levitator', 2, ['sword'], info('applies levitation'), { rarity: 'rare', desc: 'Applies Levitation on hit.' }],
  ['flinging', 'Flinging', 2, ['sword'], info('launches enemies up'), { rarity: 'uncommon', desc: 'Knocks enemies upward.' }],
  ['mortalitas', 'Mortalitas', 8, ['sword'], info('grows stronger with kills'), { rarity: 'veryRare', desc: 'Each kill raises your damage / lowers the target\u2019s, up to 8.' }],
  ['reviled_blade', 'Reviled Blade', 4, ['sword'], info('more damage at low enemy HP'), { rarity: 'veryRare', desc: 'Damage increases the lower the enemy\u2019s health.' }],
  ['instability', 'Instability', 3, ['sword'], info('more damage at low durability'), { rarity: 'veryRare', desc: 'Lower durability = more damage, at a cost.' }],
  ['atomic_deconstructor', 'Atomic Deconstructor', 2, ['sword'], info('tiny instakill chance'), { rarity: 'rare', desc: 'Small chance to instantly kill non-bosses (0.1% x Level).' }],
  ['swifter_slashes', 'Swifter Slashes', 5, ['sword'], info('attack speed + iframe bypass'), { rarity: 'veryRare', desc: '+20% swing speed and +2% iframe bypass per level.' }],
  ['heavy_weight', 'Heavy Weight', 5, ['sword'], info('reduces attack speed'), { rarity: 'rare', desc: 'Reduces attack speed.' }],
  ['bluntness', 'Bluntness', 5, ['sword'], info('reduces damage'), { rarity: 'rare', desc: 'Reduces attack damage.' }],
  ['true_strike', 'True Strike', 1, ['sword'], info('ignores evasion'), { rarity: 'rare', desc: 'Ignores 75% of Evasion; blocks Curse of Inaccuracy.' }],
  ['parry', 'Parry', 1, ['sword'], info('chance to parry'), { rarity: 'rare', desc: 'Chance to parry and knock back attackers.' }],
  ['unsheathing', 'Unsheathing', 1, ['sword'], info('auto-equip on hit'), { rarity: 'veryRare', desc: 'Auto-equips when you take damage.' }],
  ['luck_magnification', 'Luck Magnification', 2, ['weapon'], info('luck + crit damage'), { rarity: 'rare', desc: 'Increases luck; acts as Looting and boosts crit damage in mainhand.' }],
  ['adept', 'Adept', 3, ['sword'], info('more XP'), { rarity: 'rare', desc: 'Multiplies XP drops.' }],
  ['brutality', 'Brutality', 5, ['axe'], info('more armor damage'), { rarity: 'rare', desc: 'Increases damage to enemy armor.' }],
  ['culling', 'Culling', 3, ['axe'], info('execute low HP'), { rarity: 'veryRare', desc: 'Bonus crit/execute vs low-HP enemies with an axe.' }],
  ['desolator', 'Desolator', 4, ['axe'], info('negative resistance'), { rarity: 'rare', desc: 'Chance to apply negative resistance / weakness.' }],
  ['disarmament', 'Disarmament', 5, ['axe'], info('chance to disarm'), { rarity: 'rare', desc: 'Chance to disarm enemies.' }],
  ['purification', 'Purification', 5, ['axe'], info('purifies mobs'), { rarity: 'uncommon', desc: 'Purifies zombie villagers, magma cubes, etc.' }],

  // ---- Curses (universal, info) ----
  ['curse_of_decay', 'Curse of Decay', 1, ['any'], info('item despawns fast'), { rarity: 'veryRare', desc: 'Dropped item despawns within seconds.' }],
  ['curse_of_holding', 'Curse of Holding', 2, ['any'], info('debuffs holder'), { rarity: 'veryRare', desc: 'Debuffs the holder.' }],
  ['curse_of_possession', 'Curse of Possession', 1, ['any'], info('cannot be dropped'), { rarity: 'veryRare', desc: 'Item cannot be dropped; lost on death.' }],
  ['curse_of_inaccuracy', 'Curse of Inaccuracy', 2, ['sword', 'bow'], info('attacks miss'), { rarity: 'veryRare', desc: 'Melee attacks miss / bow shots are inaccurate.' }],

  // ---- Better Survival (info) ----
  ['penetration', 'Penetration', 5, ['weapon'], info('partial armor ignore'), { pack: 'rlcraft', mod: 'Better Survival', rarity: 'rare', desc: 'Damage dealt partially ignores armor.' }],
  ['vampirism', 'Vampirism', 2, ['weapon'], info('heals on hit'), { pack: 'rlcraft', mod: 'Better Survival', rarity: 'rare', desc: 'Heals you for a portion of damage dealt.' }],
  ['agility', 'Agility', 2, ['leggings'], info('movement speed'), { pack: 'rlcraft', mod: 'Better Survival', rarity: 'rare', desc: 'Increases movement speed.' }],
  ['high_jump', 'High Jump', 2, ['boots'], info('jump height'), { pack: 'rlcraft', mod: 'Better Survival', rarity: 'rare', desc: 'Increases jump height.' }],
  ['multishot', 'Multishot', 4, ['bow'], info('multiple arrows'), { pack: 'rlcraft', mod: 'Better Survival', rarity: 'rare', desc: 'Shoot multiple arrows at once.' }],
  ['rapid_fire', 'Rapid Fire', 2, ['bow'], info('faster draw'), { pack: 'rlcraft', mod: 'Better Survival', rarity: 'uncommon', desc: 'Increases bow/crossbow draw speed.' }],
  ['fling', 'Fling', 2, ['weapon'], info('launches enemies'), { pack: 'rlcraft', mod: 'Better Survival', rarity: 'rare', desc: 'Throws a hit enemy into the air.' }],

  // ---- Spartan Weaponry / Shields (info) ----
  ['razors_edge', "Razor's Edge", 5, ['weapon'], info('throwing damage'), { pack: 'rlcraft', mod: 'Spartan Weaponry', rarity: 'rare', desc: 'Increases damage of throwing weapons.' }],
  ['propulsion', 'Propulsion', 3, ['weapon'], info('throw range'), { pack: 'rlcraft', mod: 'Spartan Weaponry', rarity: 'uncommon', desc: 'Extends throwing range.' }],
  ['return', 'Return', 3, ['weapon'], info('returns to player'), { pack: 'rlcraft', mod: 'Spartan Weaponry', rarity: 'rare', desc: 'Thrown weapons return to you.' }],
  ['spikes', 'Spikes', 3, ['shield'], info('damage when blocking'), { pack: 'rlcraft', mod: 'Spartan Shields', rarity: 'rare', desc: 'Damages enemies that hit you while blocking.' }],
  ['natural_blocking', 'Natural Blocking', 2, ['shield'], info('passive block reduction'), { pack: 'rlcraft', mod: 'So Many Enchantments', rarity: 'rare', desc: 'Shield passively reduces 20%/30% of damage before armor.' }],
  ['empowered_defense', 'Empowered Defense', 2, ['shield'], info('stronger block'), { pack: 'rlcraft', mod: 'So Many Enchantments', rarity: 'rare', desc: 'Empowers the shield, can negate disabling and reflect.' }],
  ['burning_shield', 'Burning Shield', 4, ['shield'], info('ignites attackers'), { pack: 'rlcraft', mod: 'So Many Enchantments', rarity: 'rare', desc: 'Reflects damage by igniting attackers.' }],
];

const enchants = raw.map(([id, name, maxLevel, appliesTo, effect, opts = {}]) => ({
  id,
  name,
  pack: opts.pack ?? 'rlcraft',
  mod: opts.mod ?? 'So Many Enchantments',
  maxLevel,
  rarity: opts.rarity ?? 'rare',
  appliesTo,
  effect,
  incompatibleGroups: opts.groups ?? [],
  description: opts.desc ?? '',
  source: opts.src ?? SME,
}));

writeFileSync(OUT, JSON.stringify(enchants, null, 2) + '\n');
console.log(`Wrote ${enchants.length} enchants to ${OUT}`);
const withMath = enchants.filter((e) => e.effect.kind !== 'info').length;
console.log(`  with combat math: ${withMath}, info: ${enchants.length - withMath}`);
