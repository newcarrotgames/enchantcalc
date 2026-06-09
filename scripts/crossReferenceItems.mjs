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
  console.log('');
}

main();
