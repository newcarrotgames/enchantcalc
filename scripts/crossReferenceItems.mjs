// Cross-references the enchant calculator's catalog (src/data/items.json, which
// is derived from configs + the wiki) against ground-truth in-game data dumped
// by the `itemdumper` Forge mod (see itemdumper/).
//
// Workflow:
//   1. Build the mod (itemdumper/) and drop the jar into the pack's mods folder.
//   2. Load a world and run `/dumpitems` (or `/dumpitems combat`) in-game.
//      That writes <gamedir>/itemdumps/itemdump.json.
//   3. Run this script to see stat mismatches and coverage gaps:
//        node scripts/crossReferenceItems.mjs [--dump <path>] [--json <out>]
//
// Matching is by normalized display name (e.g. "Iron Dagger"), since the catalog
// uses synthetic ids (katana_iron) while the game uses registry names
// (spartanweaponry:dagger_iron). Numeric fields are compared with a tolerance.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DEFAULT_DUMP =
  '/mnt/d/curseforge/minecraft/Instances/RLCraft Dregora (Local Dev)/itemdumps/itemdump.json';

const TOLERANCE = 0.05; // damage/speed/armor rounding slack

// --- args -------------------------------------------------------------------
function parseArgs(argv) {
  const args = { dump: DEFAULT_DUMP, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dump') args.dump = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function normalizeName(name) {
  return String(name || '')
    .replace(/\u00a7./g, '') // strip Minecraft formatting codes (e.g. "§3", "§l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function approxEqual(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) <= TOLERANCE;
}

function classify(dumpItem) {
  if (dumpItem.armorPoints != null || dumpItem.armorSlot != null) return 'armor';
  if (dumpItem.attackDamage != null) return 'weapon';
  return 'other';
}

// Mainhand attribute-modifier keys that the calculator already models directly
// (attack damage/speed). Anything else (e.g. a reach attribute) is "extra" and
// worth surfacing.
const KNOWN_MAINHAND_KEYS = new Set(['generic.attackDamage', 'generic.attackSpeed']);

function extraMainhandModifiers(dumpItem) {
  const mods = dumpItem.mainhandModifiers;
  if (!mods || typeof mods !== 'object') return null;
  const extra = {};
  for (const [key, val] of Object.entries(mods)) {
    if (!KNOWN_MAINHAND_KEYS.has(key)) extra[key] = val;
  }
  return Object.keys(extra).length ? extra : null;
}

// Pull mod-specific weapon traits out of the in-game tooltip lines (dumped by
// itemdumper with formatting codes stripped). These traits (e.g. Spartan
// Weaponry's "Damage Absorption" on sabers) are NOT vanilla attributes, so the
// tooltip is the only ground-truth source.
//
// Spartan Weaponry tooltips render a "Properties:" block listing named traits
// (e.g. "- Damage Absorption", "- Sweep I", "- Reach I"). The numeric magnitude
// of each trait is hidden behind "Press SHIFT to show details", so a dump taken
// without shift held only yields the trait NAMES, not the numbers. We capture
// the named properties (the reliably-available signal) and still attempt
// numeric extraction in case a detailed tooltip is present.
function parseTooltipTraits(tooltip) {
  if (!Array.isArray(tooltip)) return null;
  const traits = {};
  const properties = [];
  let inProps = false;
  for (const raw of tooltip) {
    const line = String(raw).trim();

    if (/^Properties:/i.test(line)) {
      inProps = true;
      continue;
    }
    if (inProps) {
      if (line.startsWith('- ')) {
        properties.push(line.slice(2).trim());
        continue;
      }
      if (line === '' || /^When in/i.test(line) || /^Requirements:/i.test(line)) {
        inProps = false;
      }
    }

    let m;
    if ((m = line.match(/damage (?:reduction|absorption)[^0-9+-]*([+-]?\d+(?:\.\d+)?)\s*%?/i))) {
      traits.damageReductionPct = Number(m[1]);
    } else if ((m = line.match(/armou?r (?:piercing|penetration)[^0-9+-]*([+-]?\d+(?:\.\d+)?)\s*%?/i))) {
      traits.armorPiercingPct = Number(m[1]);
    }
  }

  if (properties.length) traits.properties = properties;
  return Object.keys(traits).length ? traits : null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/crossReferenceItems.mjs [--dump <path>] [--json <out>]');
    return;
  }

  const catalogPath = join(ROOT, 'src', 'data', 'items.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

  if (!existsSync(args.dump)) {
    console.error(`\nNo in-game dump found at:\n  ${args.dump}\n`);
    console.error('Build the mod (see itemdumper/README.md), run `/dumpitems` in-game,');
    console.error('then re-run this script (use --dump <path> if it lives elsewhere).\n');
    process.exit(1);
  }

  const dumpRaw = JSON.parse(readFileSync(args.dump, 'utf8'));
  const dumpItems = Array.isArray(dumpRaw) ? dumpRaw : dumpRaw.items || [];

  // Index dump combat items by normalized display name. A name can map to
  // multiple registry entries (rare); keep them all.
  const dumpByName = new Map();
  let dumpWeapons = 0;
  let dumpArmor = 0;
  for (const di of dumpItems) {
    const kind = classify(di);
    if (kind === 'other') continue;
    if (kind === 'weapon') dumpWeapons++;
    if (kind === 'armor') dumpArmor++;
    const key = normalizeName(di.displayName);
    if (!key) continue;
    if (!dumpByName.has(key)) dumpByName.set(key, []);
    dumpByName.get(key).push(di);
  }

  const report = {
    dumpPath: args.dump,
    matched: [],
    mismatched: [],
    catalogMissingInGame: [],
    gameMissingInCatalog: [],
    weaponTraits: [],
  };

  const matchedDumpKeys = new Set();

  for (const ci of catalog) {
    if (ci.category !== 'weapon' && ci.category !== 'armor') continue;
    if (ci.id === 'fist') continue; // bare hand, no in-game item

    const key = normalizeName(ci.name);
    const candidates = dumpByName.get(key);
    if (!candidates || candidates.length === 0) {
      report.catalogMissingInGame.push({ id: ci.id, name: ci.name, category: ci.category });
      continue;
    }
    matchedDumpKeys.add(key);
    const di = candidates[0];

    const diffs = [];
    if (ci.category === 'weapon') {
      if (!approxEqual(ci.baseDamage, di.attackDamage)) {
        diffs.push({ field: 'baseDamage', catalog: ci.baseDamage, game: di.attackDamage });
      }
      if (ci.attackSpeed != null && !approxEqual(ci.attackSpeed, di.attackSpeed)) {
        diffs.push({ field: 'attackSpeed', catalog: ci.attackSpeed, game: di.attackSpeed });
      }
    } else {
      if (ci.armorPoints != null && !approxEqual(ci.armorPoints, di.armorPoints)) {
        diffs.push({ field: 'armorPoints', catalog: ci.armorPoints, game: di.armorPoints });
      }
      if (ci.toughness != null && !approxEqual(ci.toughness, di.toughness)) {
        diffs.push({ field: 'toughness', catalog: ci.toughness, game: di.toughness });
      }
    }

    const entry = {
      id: ci.id,
      name: ci.name,
      registryName: di.registryName,
      category: ci.category,
      diffs,
    };

    if (ci.category === 'weapon') {
      const traits = parseTooltipTraits(di.tooltip);
      const extraMods = extraMainhandModifiers(di);
      if (traits || extraMods) {
        const t = { id: ci.id, name: ci.name, registryName: di.registryName };
        if (traits) t.traits = traits;
        if (extraMods) t.extraModifiers = extraMods;
        if (Array.isArray(di.tooltip)) t.tooltip = di.tooltip;
        report.weaponTraits.push(t);
      }
    }

    if (diffs.length) report.mismatched.push(entry);
    else report.matched.push(entry);
  }

  // In-game combat items with no catalog match (gaps / phantom-free check).
  for (const [key, entries] of dumpByName) {
    if (matchedDumpKeys.has(key)) continue;
    const di = entries[0];
    report.gameMissingInCatalog.push({
      name: di.displayName,
      registryName: di.registryName,
      category: classify(di),
    });
  }

  printReport(report, {
    catalogCombat: catalog.filter((c) => c.category === 'weapon' || c.category === 'armor').length,
    dumpWeapons,
    dumpArmor,
  });

  if (args.json) {
    writeFileSync(args.json, JSON.stringify(report, null, 2) + '\n');
    console.log(`\nWrote detailed JSON report to ${args.json}`);
  }
}

function fmt(v) {
  return v == null ? 'n/a' : v;
}

function printReport(report, stats) {
  const line = '-'.repeat(72);
  console.log(line);
  console.log('ENCHANTCALC ITEM CROSS-REFERENCE');
  console.log(line);
  console.log(`dump:              ${report.dumpPath}`);
  console.log(`catalog combat:    ${stats.catalogCombat} items`);
  console.log(`dump weapons/armor:${stats.dumpWeapons} / ${stats.dumpArmor}`);
  console.log('');
  console.log(`matched (ok):      ${report.matched.length}`);
  console.log(`mismatched stats:  ${report.mismatched.length}`);
  console.log(`catalog not found: ${report.catalogMissingInGame.length}`);
  console.log(`game not in catalog:${report.gameMissingInCatalog.length}`);
  console.log(`weapon traits found:${report.weaponTraits ? report.weaponTraits.length : 0}`);

  if (report.mismatched.length) {
    console.log('\n' + line + '\nSTAT MISMATCHES (catalog vs in-game)\n' + line);
    for (const m of report.mismatched) {
      const ds = m.diffs
        .map((d) => `${d.field}: ${fmt(d.catalog)} != ${fmt(d.game)}`)
        .join('; ');
      console.log(`  ${m.name}  [${m.registryName}]`);
      console.log(`      ${ds}`);
    }
  }

  if (report.catalogMissingInGame.length) {
    console.log('\n' + line + '\nIN CATALOG BUT NOT FOUND IN GAME (possible phantom combos)\n' + line);
    for (const c of report.catalogMissingInGame) {
      console.log(`  ${c.name}  (${c.id}, ${c.category})`);
    }
  }

  if (report.gameMissingInCatalog.length) {
    console.log('\n' + line + '\nIN GAME BUT NOT IN CATALOG (coverage gaps)\n' + line);
    for (const g of report.gameMissingInCatalog) {
      console.log(`  ${g.name}  [${g.registryName}] (${g.category})`);
    }
  }

  if (report.weaponTraits && report.weaponTraits.length) {
    console.log(
      '\n' + line + '\nWEAPON TRAITS FROM IN-GAME TOOLTIP (not vanilla attributes)\n' + line,
    );
    console.log('  (informational: the catalog has no numeric field for these yet)');
    for (const w of report.weaponTraits) {
      const parts = [];
      if (w.traits) {
        for (const [k, v] of Object.entries(w.traits)) {
          if (k === 'properties') parts.push(`properties=[${v.join(', ')}]`);
          else parts.push(`${k}=${v}`);
        }
      }
      if (w.extraModifiers) {
        for (const [k, v] of Object.entries(w.extraModifiers)) parts.push(`${k}=${v}`);
      }
      console.log(`  ${w.name}  [${w.registryName}]`);
      console.log(`      ${parts.join('; ')}`);
    }
  } else if (report.weaponTraits) {
    console.log(
      '\n' + line + '\nWEAPON TRAITS FROM IN-GAME TOOLTIP\n' + line +
        '\n  none parsed (dump may predate the tooltip/mainhandModifiers fields,' +
        '\n  or no weapon exposed a recognized trait)',
    );
  }
  console.log('');
}

main();
