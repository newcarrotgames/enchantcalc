// Generates src/data/baubles.json for the RLCraft enchant calculator.
//
// The bauble LIST is derived from the in-game item dump (itemdumps/itemdump.json
// in the local RLCraft Dregora install): every item whose tooltip carries a
// "Bauble (X)" slot line. The effect MAGNITUDES are not machine-readable in the
// dump (bauble effects are custom-coded, not attribute modifiers), so the
// combat numbers below are hand-encoded from verified sources (mod configs +
// in-game tooltips) and cited; everything else ships as a searchable "info"
// entry, mirroring how enchants are handled.
//
// On a machine with the local install present, this script refreshes the
// committed snapshot scripts/baublesDump.json so regeneration stays reproducible
// without the install (e.g. in CI).
//
// Sources:
//   RLArtifacts:        config/RLArtifacts.cfg (Attack Damage 3.0 op0, Attack Speed 0.2 op1)
//   Bountiful Baubles:  in-game tooltips (itemdump.json)
//   Quark hats:         in-game tooltips (+7 Locational Armor on head)
//
// Re-run with:  node scripts/generateBaubles.mjs

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'baubles.json');
const SNAPSHOT = join(__dirname, 'baublesDump.json');
const DUMP =
  '/mnt/d/curseforge/minecraft/Instances/RLCraft Dregora (Local Dev)/itemdumps/itemdump.json';

// --- effect builders (level fixed at 1; `base` carries the value) ----------
const dmg = (base, condition) => ({
  kind: 'flatDamage',
  base,
  perLevel: 0,
  ...(condition ? { condition } : {}),
});
const dmgMult = (frac) => ({ kind: 'damageMultiplier', base: frac, perLevel: 0 });
const spd = (frac) => ({ kind: 'attackSpeedMultiplier', base: frac, perLevel: 0 });
const locArmor = (v) => ({ kind: 'locationalArmor', base: v, perLevel: 0 });
const pctRed = (frac, damageType) => ({
  kind: 'percentReduction',
  perLevelPct: frac,
  cap: 0.8,
  ...(damageType ? { damageType } : {}),
});

// --- verified combat effects, keyed by in-game registry name ---------------
// Only baubles with a source-verified numeric effect appear here; the rest are
// generated as info-only entries.
const CFG = 'config/RLArtifacts.cfg (Attack Damage 3.0 op0, Attack Speed 0.2 op1)';
const TT = 'In-game tooltip (itemdump.json)';
const EFFECTS = {
  'artifacts:power_glove': { effects: [dmg(3)], source: CFG },
  'artifacts:feral_claws': { effects: [spd(0.2)], source: CFG },
  'artifacts:mechanical_glove': { effects: [dmg(3), spd(0.2)], source: CFG },
  // Fire Gauntlet also lights targets on fire (chance-based; not modelled).
  'artifacts:fire_gauntlet': { effects: [dmg(3), spd(0.2)], source: CFG },
  'bountifulbaubles:amuletsinwrath': { effects: [dmg(2)], source: TT },
  // Quark hats double as head armor: +7 locational armor on the head region.
  'quark:witch_hat': { effects: [locArmor(7)], source: TT },
  'quark:pirate_hat': { effects: [locArmor(7)], source: TT },
  'quark:archaeologist_hat': { effects: [locArmor(7)], source: TT },
  // Obsidian Skull: 50% fire damage resistance (does not protect against lava).
  'bountifulbaubles:trinketobsidianskull': {
    effects: [pctRed(0.5, 'fire')],
    source: TT,
  },
};

// --- display metadata ------------------------------------------------------
const MOD_NAMES = {
  minecraft: 'Minecraft',
  baubles: 'Baubles',
  bountifulbaubles: 'Bountiful Baubles',
  artifacts: 'RLArtifacts',
  xat: 'Trinkets and Baubles',
  defiledlands: 'Defiled Lands',
  quark: 'Quark',
  iceandfire: 'Ice and Fire',
  potionfingers: 'Potion Fingers',
  qualitytools: 'Quality Tools',
  spartanweaponry: 'Spartan Weaponry',
  nuclearcraft: 'NuclearCraft',
  toolbelt: 'Tool Belt',
  wearablebackpacks: 'Wearable Backpacks',
  mod_lavacow: 'Savage & Ravage',
};

// baubleType -> palette group label + fallback SVG shape.
const TYPE_LABEL = {
  amulet: 'Amulets',
  ring: 'Rings',
  belt: 'Belts',
  head: 'Head Baubles',
  body: 'Body Baubles',
  charm: 'Charms',
  any: 'Universal',
};
const TYPE_SHAPE = {
  amulet: 'amulet',
  ring: 'ring',
  belt: 'belt',
  head: 'amulet',
  body: 'charm',
  charm: 'charm',
  any: 'charm',
};

const stripColor = (s) => s.replace(/\u00a7./g, '');

// Build a clean description from the dump tooltip: drop the name, the slot line,
// stat lines we encode elsewhere, and Baubles' structural cruft.
function descriptionFrom(tooltip, name) {
  const drop = [
    /^Bauble \(/i,
    /^(Press|Hold) Shift/i,
    /Shielding Power/i,
    /RF$/,
    /^Requirements:?$/i,
    /^\s*-\s*\w+:/,
    /^When (on|in|worn)/i,
    /Locational Armor/i,
    /Knockback Resistance/i,
  ];
  const lines = tooltip
    .map(stripColor)
    .map((l) => l.trim())
    .filter((l, i) => i !== 0 && l && !drop.some((re) => re.test(l)));
  return lines.join(' ');
}

function idFrom(registryName, metadata) {
  const base = `bauble_${registryName.replace(/[^a-z0-9]+/gi, '_')}`.toLowerCase();
  return metadata ? `${base}_m${metadata}` : base;
}

// --- load the bauble list (live dump preferred, snapshot fallback) ---------
const SLOT_RE = /^Bauble \(([^)]+)\)$/;

function extractFromDump(path) {
  const dump = JSON.parse(readFileSync(path, 'utf8'));
  const out = [];
  const seen = new Set();
  for (const it of dump.items) {
    const tooltip = (it.tooltip ?? []).map(stripColor);
    let slot = null;
    for (const line of tooltip) {
      const m = SLOT_RE.exec(line.trim());
      if (m) {
        slot = m[1].toLowerCase();
        break;
      }
    }
    if (!slot) continue;
    if (seen.has(it.registryName)) continue;
    seen.add(it.registryName);
    out.push({
      registryName: it.registryName,
      modId: it.modId,
      displayName: stripColor(it.displayName),
      translationKey: it.translationKey ?? '',
      metadata: it.metadata ?? 0,
      slot,
      tooltip: it.tooltip ?? [],
    });
  }
  return out;
}

let raw;
if (existsSync(DUMP)) {
  raw = extractFromDump(DUMP);
  writeFileSync(SNAPSHOT, JSON.stringify(raw, null, 2) + '\n');
  console.log(`Refreshed snapshot ${SNAPSHOT} (${raw.length} baubles)`);
} else if (existsSync(SNAPSHOT)) {
  raw = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  console.log(`Using committed snapshot ${SNAPSHOT} (${raw.length} baubles)`);
} else {
  throw new Error(
    'No item dump and no snapshot found. Run /dumpitems in-game, or restore scripts/baublesDump.json.',
  );
}

// --- map to BaubleDef ------------------------------------------------------
const baubles = raw.map((b) => {
  const baubleType = b.slot; // amulet|ring|belt|head|body|charm|any
  const override = EFFECTS[b.registryName];
  return {
    id: idFrom(b.registryName, b.metadata),
    name: b.displayName,
    pack: b.modId === 'minecraft' ? 'vanilla' : 'rlcraft',
    mod: MOD_NAMES[b.modId] ?? b.modId,
    registryName: b.registryName,
    baubleType,
    icon: `${TYPE_SHAPE[baubleType] ?? 'charm'}:default`,
    group: TYPE_LABEL[baubleType] ?? 'Baubles',
    effects: override?.effects ?? [],
    description: descriptionFrom(b.tooltip, b.displayName),
    source: override?.source ?? 'RLCraft Dregora install: itemdump.json',
  };
});

// Stable ordering: by group label, then name.
baubles.sort(
  (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
);

writeFileSync(OUT, JSON.stringify(baubles, null, 2) + '\n');
const withMath = baubles.filter((b) => b.effects.length > 0).length;
console.log(`Wrote ${baubles.length} baubles to ${OUT} (${withMath} with combat math)`);
