// Extracts the real in-game item textures from the RLCraft Dregora install and
// writes them to src/assets/item-icons/<itemId>.png, so the calculator can show
// authentic Minecraft sprites instead of the procedural SVG placeholders.
//
// The procedural SVGs in src/components/icons.tsx remain as a fallback for any
// item whose texture could not be extracted (e.g. `fist`).
//
// Source of truth: the local RLCraft Dregora install (see AGENTS.md).
//   - Spartan Weaponry native-material weapons  -> SpartanWeaponry jar
//   - Spartan Fire dragonbone/myrmex weapons     -> spartanfire_rlcraft jar
//   - Spartan Defiled umbrium weapons            -> spartandefiled jar
//   - Vanilla weapons + vanilla armor            -> Minecraft 1.12.2 client jar
//   - Steel armor                                -> RLMixins jar
//   - Dragon Scale + Myrmex Chitin armor         -> Ice and Fire jar
//
// Texture file names mostly match our item ids 1:1 (e.g. `katana_iron`); the
// maps below cover the cases where the mod's naming differs from ours.
//
// Re-run with:  node scripts/extractIcons.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ITEMS = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'items.json'), 'utf8'),
);
const BAUBLES = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'baubles.json'), 'utf8'),
);
const OUT_DIR = join(__dirname, '..', 'src', 'assets', 'item-icons');

const INSTANCE = '/mnt/d/curseforge/minecraft/Instances/RLCraft Dregora (Local Dev)';
const MODS = join(INSTANCE, 'mods');
const VANILLA_JAR = '/mnt/d/curseforge/minecraft/Install/versions/1.12.2/1.12.2.jar';

// jar key -> { jar absolute path, assets namespace }
const JARS = {
  sw: { jar: join(MODS, 'SpartanWeaponry-1.12.2-1.6.1.jar'), ns: 'spartanweaponry' },
  fire: { jar: join(MODS, 'spartanfire_rlcraft-1.3.3.jar'), ns: 'spartanfire' },
  defiled: { jar: join(MODS, 'spartandefiled-1.12.2-1.2.jar'), ns: 'spartandefiled' },
  iaf: { jar: join(MODS, 'Ice and Fire-2.0.9.jar'), ns: 'iceandfire' },
  rlmixins: { jar: join(MODS, 'RLMixins-1.4.6.jar'), ns: 'rlmixins' },
  bs: { jar: join(MODS, 'better_survival-1.5.4.jar'), ns: 'mujmajnkraftsbettersurvival' },
  fi: { jar: join(MODS, 'forgottenitems-1.12.2-1.3.1.4.jar'), ns: 'forgottenitems' },
  vanilla: { jar: VANILLA_JAR, ns: 'minecraft' },
  // Bauble-providing mods (mod id -> jar).
  bountifulbaubles: { jar: join(MODS, 'Bountiful Baubles-1.12.2-0.1.8.jar'), ns: 'bountifulbaubles' },
  artifacts: { jar: join(MODS, 'RLArtifacts-1.1.2.jar'), ns: 'artifacts' },
  xat: { jar: join(MODS, 'Trinkets and Baubles-0.32.5.jar'), ns: 'xat' },
  baubles: { jar: join(MODS, 'Baubles-1.12-1.5.2.jar'), ns: 'baubles' },
  defiledlands: { jar: join(MODS, 'defiledlands-1.12.2-1.4.3.jar'), ns: 'defiledlands' },
  // Armor-providing mods (keyed by mod id; armor icons resolve via registryName).
  iceandfire: { jar: join(MODS, 'Ice and Fire-2.0.9.jar'), ns: 'iceandfire' },
  forgottenitems: { jar: join(MODS, 'forgottenitems-1.12.2-1.3.1.4.jar'), ns: 'forgottenitems' },
  aquaculture: { jar: join(MODS, 'Aquaculture-1.12.2-1.6.8.jar'), ns: 'aquaculture' },
  nuclearcraft: { jar: join(MODS, 'nuclearcraft-1.12.2-2.19a.jar'), ns: 'nuclearcraft' },
  simpledifficulty: { jar: join(MODS, 'SimpleDifficulty-1.12.2-0.3.9.jar'), ns: 'simpledifficulty' },
  srparasites: { jar: join(MODS, 'SRParasites-1.12.2v1.9.21.jar'), ns: 'srparasites' },
  grapplemod: { jar: join(MODS, 'grapplemod-1.12.2-v12.3.jar'), ns: 'grapplemod' },
  variedcommodities: { jar: join(MODS, 'VariedCommodities_1.12.2-(31Mar23).jar'), ns: 'variedcommodities' },
};

// registryName -> translationKey, from the committed bauble dump snapshot.
// Used to recover snake_case texture names (e.g. Bountiful Baubles stores
// `amulet_sin_wrath.png` while the registry path is `amuletsinwrath`).
let BAUBLE_TKEY = {};
try {
  const snap = JSON.parse(readFileSync(join(__dirname, 'baublesDump.json'), 'utf8'));
  for (const b of snap) BAUBLE_TKEY[b.registryName] = b.translationKey ?? '';
} catch {
  /* snapshot optional */
}

const camelToSnake = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// Nunchaku icon material key -> Better Survival texture base name. Vanilla +
// Better Survival metals are prefixed `item`; Ice and Fire materials are not.
const NUNCHAKU_TEX = {
  wood: 'itemwood',
  stone: 'itemstone',
  iron: 'itemiron',
  gold: 'itemgold',
  diamond: 'itemdiamond',
  copper: 'itemcopper',
  bronze: 'itembronze',
  invar: 'iteminvar',
  silver: 'itemsilver',
  electrum: 'itemelectrum',
  aluminium: 'itemaluminium',
  steel: 'itemsteel',
  signalum: 'itemsignalum',
  lumium: 'itemlumium',
  enderium: 'itemenderium',
  dragonbone: 'dragonbone',
  fire_dragonbone: 'firedragonbone',
  ice_dragonbone: 'icedragonbone',
  lightning_dragonbone: 'lightningdragonbone',
  desert_myrmex: 'desertchitin',
  desert_venom: 'desertstinger',
  jungle_myrmex: 'junglechitin',
  jungle_venom: 'junglestinger',
};

// Spartan addon material key (our icon material) -> { jar, texture suffix }.
// Native Spartan Weaponry metals share their key with the texture name.
const ADDON_MATERIALS = {
  dragonbone: { jar: 'fire', tex: 'dragon' },
  fire_dragonbone: { jar: 'fire', tex: 'fire_dragon' },
  ice_dragonbone: { jar: 'fire', tex: 'ice_dragon' },
  lightning_dragonbone: { jar: 'fire', tex: 'lightning_dragon' },
  desert_myrmex: { jar: 'fire', tex: 'desert' },
  jungle_myrmex: { jar: 'fire', tex: 'jungle' },
  desert_venom: { jar: 'fire', tex: 'desert_venom' },
  jungle_venom: { jar: 'fire', tex: 'jungle_venom' },
  umbrium: { jar: 'defiled', tex: 'umbrium' },
};

// Vanilla weapon id prefix -> Minecraft texture material name.
const VANILLA_WEAPON_MAT = { wooden: 'wood', golden: 'gold' };

// Items with no sensible texture; keep the procedural SVG fallback.
const SKIP = new Set(['fist']);

/** Resolve an item to { jar, tex } describing its source texture, or null. */
function resolveTexture(item) {
  if (SKIP.has(item.id)) return null;
  const material = item.icon.split(':')[1];

  if (item.category === 'weapon') {
    if (item.pack === 'vanilla') {
      const [matWord, type] = item.id.split('_'); // e.g. golden_axe
      const mat = VANILLA_WEAPON_MAT[matWord] ?? matWord;
      return { jar: 'vanilla', tex: `${mat}_${type}` };
    }
    // Nunchaku (Better Survival) use their own, irregular texture names.
    if (item.id.startsWith('nunchaku_')) {
      const base = NUNCHAKU_TEX[material];
      if (base) return { jar: 'bs', tex: `${base}nunchaku` };
      return null;
    }
    // Spartan weapon id is `${type}_${material}`; strip the material suffix.
    const type = item.id.slice(0, item.id.length - material.length - 1);
    const addon = ADDON_MATERIALS[material];
    if (addon) return { jar: addon.jar, tex: `${type}_${addon.tex}` };
    return { jar: 'sw', tex: `${type}_${material}` };
  }

  if (item.category === 'armor') {
    // Armor is dump-derived and carries its in-game registry name; the texture
    // file is assets/<modId>/textures/items/<path>.png (Minecraft uses "gold"
    // where the registry path says "golden").
    if (!item.registryName) return null;
    const [modId, path] = item.registryName.split(':');
    if (modId === 'minecraft') {
      return { jar: 'vanilla', tex: path.replace(/^golden_/, 'gold_') };
    }
    if (JARS[modId]) return { jar: modId, tex: path };
    return null; // unmapped mod -> SVG fallback
  }

  return null;
}

// Read width/height from a PNG buffer's IHDR chunk (big-endian, bytes 16-23).
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Some modded textures (e.g. lightning_dragonbone "Shocked" weapons) ship as
// animated vertical frame-strips (height = N * width) with a .mcmeta. We only
// want a static icon, so crop to the first frame (the top square) via ImageMagick.
function cropFirstFrame(srcPath, width, destPath) {
  execFileSync('convert', [
    srcPath,
    '-crop',
    `${width}x${width}+0+0`,
    '+repage',
    destPath,
  ]);
}

function writeBuf(buf, destPath) {
  if (!buf || buf.length === 0) throw new Error('empty');
  writeFileSync(destPath, buf);
  const { width, height } = pngSize(buf);
  if (height > width && height % width === 0) {
    cropFirstFrame(destPath, width, destPath);
  }
}

function extract(jarKey, tex, destPath) {
  const { jar, ns } = JARS[jarKey];
  const internal = `assets/${ns}/textures/items/${tex}.png`;
  const buf = execFileSync('unzip', ['-p', jar, internal], {
    maxBuffer: 16 * 1024 * 1024,
  });
  writeBuf(buf, destPath);
}

// Baubles: registryName is `mod:path`. The texture file name is usually the
// path, but some mods (Bountiful Baubles) use the snake_case of the camelCase
// translation key. Try both names under textures/items/ and textures/item/.
function extractBauble(bauble, destPath) {
  const [modId, path] = bauble.registryName.split(':');
  const jarKey = JARS[modId] ? modId : null;
  if (!jarKey) return false;
  const { jar, ns } = JARS[jarKey];

  const names = new Set([path]);
  const tkey = BAUBLE_TKEY[bauble.registryName];
  if (tkey) names.add(camelToSnake(tkey.split('.').pop()));

  for (const dir of ['items', 'item']) {
    for (const name of names) {
      try {
        const buf = execFileSync(
          'unzip',
          ['-p', jar, `assets/${ns}/textures/${dir}/${name}.png`],
          { maxBuffer: 16 * 1024 * 1024 },
        );
        writeBuf(buf, destPath);
        return true;
      } catch {
        /* try next candidate */
      }
    }
  }
  return false;
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let ok = 0;
const missing = []; // weapons: a miss is a real bug (fatal)
const armorMissing = []; // armor: best-effort, falls back to SVG (non-fatal)
const skipped = [];
for (const item of ITEMS) {
  const src = resolveTexture(item);
  if (!src) {
    skipped.push(item.id);
    continue;
  }
  try {
    extract(src.jar, src.tex, join(OUT_DIR, `${item.id}.png`));
    ok++;
  } catch {
    const dest = item.category === 'armor' ? armorMissing : missing;
    dest.push(`${item.id}  (looked for ${src.jar}:${src.tex})`);
  }
}

console.log(`Extracted ${ok}/${ITEMS.length} item icons to ${OUT_DIR}`);
if (skipped.length) console.log(`Skipped (SVG fallback): ${skipped.length} items`);
if (armorMissing.length) {
  console.log(`\nArmor SVG fallback (${armorMissing.length}): no mapped texture`);
}
if (missing.length) {
  console.log(`\nMISSING (${missing.length}):`);
  for (const m of missing) console.log('  ' + m);
  process.exitCode = 1;
}

// Baubles are best-effort: missing sprites fall back to the procedural SVGs in
// icons.tsx, so they do not fail the run.
let bok = 0;
const bmissing = [];
for (const bauble of BAUBLES) {
  try {
    if (extractBauble(bauble, join(OUT_DIR, `${bauble.id}.png`))) bok++;
    else bmissing.push(`${bauble.id}  (${bauble.registryName})`);
  } catch {
    bmissing.push(`${bauble.id}  (${bauble.registryName})`);
  }
}
console.log(`\nExtracted ${bok}/${BAUBLES.length} bauble icons (rest use SVG fallback)`);
if (bmissing.length) {
  console.log(`Bauble SVG fallback (${bmissing.length}): ${bmissing.length} entries`);
}
