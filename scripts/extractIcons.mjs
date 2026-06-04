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
  vanilla: { jar: VANILLA_JAR, ns: 'minecraft' },
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

// Armor set key (id minus the slot) -> resolver producing { jar, tex }.
// Dragon Scale has many color variants in Ice and Fire that share stats; we use
// the red (fire dragon) set as the representative sprite.
const ARMOR_SETS = {
  leather: (slot) => ({ jar: 'vanilla', tex: `leather_${slot}` }),
  golden: (slot) => ({ jar: 'vanilla', tex: `gold_${slot}` }),
  chainmail: (slot) => ({ jar: 'vanilla', tex: `chainmail_${slot}` }),
  iron: (slot) => ({ jar: 'vanilla', tex: `iron_${slot}` }),
  diamond: (slot) => ({ jar: 'vanilla', tex: `diamond_${slot}` }),
  steel: (slot) => ({ jar: 'rlmixins', tex: `steel_${slot}` }),
  dragonscale: (slot) => ({ jar: 'iaf', tex: `armor_red_${slot}` }),
  desert_myrmex_chitin: (slot) => ({ jar: 'iaf', tex: `myrmex_desert_${slot}` }),
  jungle_myrmex_chitin: (slot) => ({ jar: 'iaf', tex: `myrmex_jungle_${slot}` }),
};

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
    // Spartan weapon id is `${type}_${material}`; strip the material suffix.
    const type = item.id.slice(0, item.id.length - material.length - 1);
    const addon = ADDON_MATERIALS[material];
    if (addon) return { jar: addon.jar, tex: `${type}_${addon.tex}` };
    return { jar: 'sw', tex: `${type}_${material}` };
  }

  if (item.category === 'armor') {
    const slot = item.slot; // helmet | chestplate | leggings | boots
    const setKey = item.id.slice(0, item.id.length - slot.length - 1);
    const resolver = ARMOR_SETS[setKey];
    if (resolver) return resolver(slot);
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

function extract(jarKey, tex, destPath) {
  const { jar, ns } = JARS[jarKey];
  const internal = `assets/${ns}/textures/items/${tex}.png`;
  const buf = execFileSync('unzip', ['-p', jar, internal], {
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!buf || buf.length === 0) throw new Error('empty');
  writeFileSync(destPath, buf);

  const { width, height } = pngSize(buf);
  if (height > width && height % width === 0) {
    cropFirstFrame(destPath, width, destPath);
  }
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let ok = 0;
const missing = [];
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
    missing.push(`${item.id}  (looked for ${src.jar}:${src.tex})`);
  }
}

console.log(`Extracted ${ok}/${ITEMS.length} item icons to ${OUT_DIR}`);
if (skipped.length) console.log(`Skipped (SVG fallback): ${skipped.join(', ')}`);
if (missing.length) {
  console.log(`\nMISSING (${missing.length}):`);
  for (const m of missing) console.log('  ' + m);
  process.exitCode = 1;
}
