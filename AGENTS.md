# AGENTS.md

Context for AI agents working on the **RLCraft Enchant Calculator**. Read this
before making changes - especially the "Data is generated" and "Game mechanics"
sections, which encode hard-won, verified facts about RLCraft.

## What this project is

A Minecraft-styled, static web app for RLCraft (and RLCraft Dregora) players.
Drag items + enchants onto a build board and see weapon damage ranges and armor
damage reduction. Pure, unit-tested calculation engine; everything ships static.

- Stack: React 18 + TypeScript + Vite, `@dnd-kit` (drag/drop), `zustand` (state),
  Vitest (tests). Node v20.18.2 - toolchain versions are pinned in `package.json`
  for this Node; do not bump blindly.
- `base: './'` so `dist/` deploys to any static host.

## Commands

```bash
npm run dev      # dev server (note: may land on 5174 if 5173 is taken)
npm test         # vitest run (engine tests)
npm run build    # tsc -b && vite build  (always run before declaring done)
node scripts/generateItems.mjs     # regenerate src/data/items.json
node scripts/generateEnchants.mjs  # regenerate src/data/enchants.json
node scripts/extractIcons.mjs      # re-extract real sprites (needs local install)
```

## Architecture

```
scripts/       generateItems.mjs, generateEnchants.mjs  <- SOURCE OF TRUTH for data
               crossReferenceItems.mjs (diff in-game dump vs catalog)
itemdumper/    Forge 1.12.2 mod that dumps in-game item stats to JSON (see below)
src/
  data/        items.json, enchants.json (GENERATED), catalog.ts (typed accessor)
  engine/      weapon.ts, armor.ts, incompat.ts (pure functions) + __tests__/
  store/       buildStore.ts (zustand), urlState.ts (shareable URL hash)
  components/  App, BuildBoard, ItemPalette, EnchantPalette, StatsPanel, icons, MCTooltip
  types.ts     shared domain types (ItemDef, EnchantDef, BuildState, ...)
```

## Data is generated - DO NOT hand-edit the JSON

`src/data/items.json` (~507 entries) and `src/data/enchants.json` (~103 entries)
are produced by the scripts in `scripts/`. To change catalog data, edit the data
arrays in those scripts and re-run them, then `npm run build`. Hand-edits to the
JSON will be wiped on the next regen.

- Item IDs are `type_material` for weapons (e.g. `katana_iron`,
  `katana_fire_dragonbone`) and `set_slot` for armor (e.g. `diamond_helmet`).
  Vanilla weapons keep simple IDs (`iron_sword`, `diamond_axe`, `fist`).
- Icon field is **`shape:material`** (colon-separated, e.g. `sword:iron`,
  `chestplate:diamond`). Material may contain underscores.
- Item icons render the **real in-game sprites** in `src/assets/item-icons/<id>.png`,
  extracted from the modpack jars by `scripts/extractIcons.mjs` (GENERATED; do not
  hand-edit). `ItemIcon` looks up the PNG by item id and falls back to the
  procedural `shape:material` SVGs in `src/components/icons.tsx` when no sprite
  exists (e.g. `fist`). When adding items, re-run `extractIcons.mjs`; add new SVG
  shapes/material colors only as a fallback.
- Optional `group` field controls the palette accordion section.

## Game mechanics (verified - keep faithful)

### Weapon damage (Spartan Weaponry)

From `config/spartanweaponry.cfg`:
`attackDamage = damageMultiplier * materialBaseDamage + weaponDamageBase`,
attack speed = the weapon type's `speed`/`meleeSpeed`. Because damage is linear
in the material base, each material's base damage is one constant applied across
all 21 weapon types. Derived material bases match the config exactly where they
overlap (silver 1.5, steel 2.5, bronze 2.0, ...). Modded materials (dragonbone
family, umbrium, myrmex family) only exist for the weapon types the Spartan Fire /
Spartan Defiled addons register. `weapon.ts` adds crit (x1.5) and conditional
bonuses for the "max"; flat enchant damage is added AFTER the crit (1.12 order).

### Armor = locational (First Aid), NOT vanilla summed

This is the most important and non-obvious part. RLCraft uses the First Aid mod.
Items store **vanilla armor points**; the engine converts to per-region
"locational armor" at calc time using `config/firstaid.cfg`:

```
locationalArmor = vanillaArmorPoints * multiplier + offset
  head x4 +3   chest x2 +3   legs x2 +4   feet x3 +3   (toughness x1 +0)
```

This reproduces the wiki's published locational numbers exactly (e.g. Dragon
Scale vanilla 4/9/7/4 -> locational 19/21/18/15). Per region, layers combine
multiplicatively, each capped 80%: (1) Resistance 20%/level, (2) protection
enchants on that piece in LOCAL_ENCHANTMENTS mode (vanilla EPF x per-enchant
local multiplier: Protection x4, Projectile/Blast/Fire x2; plus any RLCraft
percent-reduction protections from the enchant's `perLevelPct`), (3) locational armor + toughness via the vanilla
formula. Overall figure is **hit-weighted** (head 1, body+arms 3, legs 2, feet 2
of 8 limbs). Head and Body are critical (lethal). Armor only mitigates physical/
projectile/blast, not raw magic/fire.

### Enchants

29 combat enchants carry real math (`flatDamage`, `percentReduction`,
`vanillaProtection`); the rest are `info` entries (searchable, no numeric effect).
Enchants sharing an `incompatibleGroups` id are mutually exclusive on one item
(e.g. all melee damage enchants share `melee_damage`; all protections share
`protection`).

## Verified RLCraft facts (don't regress these)

- **Dragonsteel armor does NOT exist.** The pack uses the "I&F: RLCraft Edition"
  fork of Ice and Fire (`Ice and Fire-2.0.9.jar`), which has no dragonsteel.
  Dragon Scale is the top dragon armor.
- **Steel armor exists** (`rlmixins:steel_*`, RLMixins) as a full 4-piece set,
  between iron and diamond, with the "Flame Hardened" set bonus.
- **Myrmex Chitin** (Desert + Jungle) is a full 4-piece set, on par with diamond.
- Parrying Dagger is disabled in config (excluded). Bows/crossbows are not
  generated (the engine models melee/armor only).

## Source of truth: the local RLCraft Dregora install

Authoritative game data lives at (WSL path):
`/mnt/d/curseforge/minecraft/Instances/RLCraft Dregora (Local Dev)`

- `config/spartanweaponry.cfg` - weapon damage/speed + material base damages
- `config/firstaid.cfg` - locational armor multipliers/offsets, body-part HP
- `config/somanyenchantments.cfg` - enchant values
- `crafttweaker.log` - concrete registered item IDs + material traits (partial)
- `mods/*.jar` lang files (`unzip -p <jar> assets/<modid>/lang/en_US.lang`) -
  authoritative item names/IDs. Note "Ice and Fire-2.0.9.jar" has spaces in the
  filename and uses `en_US.lang` (capital US).

Cross-check uncertain numbers against the RLCraft wiki (rlcraft.wiki.gg /
rlcraft.fandom.com) before encoding them. Prefer local files over memory.

## Item dumper mod (itemdumper/) - ground-truth validation

`itemdumper/` is a small **Minecraft 1.12.2 / Forge** mod that dumps every
registered item's real in-game stats to JSON, so the generated catalog can be
cross-referenced against ground truth instead of hand-derived numbers. It adds
one server command, `/dumpitems [all|weapons|armor|combat]`, that walks the item
registry, enumerates every creative sub-item, and writes attack damage/speed
(from the mainhand attribute modifiers, which is how Spartan Weaponry etc. set
damage), armor points/toughness, durability, mod id, food values, etc.

Build toolchain quirks (these are load-bearing; do not "modernize" blindly):

- Requires a **Java 8 JDK** at `/usr/lib/jvm/java-8-openjdk-amd64`. The gradle
  wrapper is pinned to **Gradle 4.10.3** and the plugin to **ForgeGradle 2.3.10**.
- Compiled against **Forge 14.23.5.2847**, NOT the pack's runtime 2860. Builds
  2855/2860 only publish a `userdev3` artifact that FG 2.3 cannot consume; 2847
  is the last build with the `userdev` artifact FG 2.3 needs. The jar is
  ABI-compatible and runs fine on 2860.
- The MDK uses `stable_39` mappings, which already use the newer method names
  (`ResourceLocation.getNamespace()/getPath()`, `ItemStack.getTranslationKey()`).
- `gradle.properties` sets `-Xmx3G` (the decompile/genSrgs steps OOM otherwise).
- Generating the wrapper needed the build script moved aside first (Gradle 8.x
  can't evaluate the FG 2.3 script).

Usage:

```bash
./itemdumper/build-and-install.sh   # builds (Java 8) + copies jar into the pack's mods/
# then in-game, op/cheats on, run:  /dumpitems combat
node scripts/crossReferenceItems.mjs   # diffs the dump vs src/data/items.json
```

- Output goes to `<gamedir>/itemdumps/itemdump[-filter].json`, i.e. inside the
  local install: `.../RLCraft Dregora (Local Dev)/itemdumps/`.
- The command is manual (registered on `FMLServerStartingEvent`); it does NOT
  auto-dump on startup.
- `crossReferenceItems.mjs` matches catalog items to in-game items by normalized
  display name and reports stat mismatches, catalog items not found in game
  (possible phantom material/weapon combos), and in-game combat items missing
  from the catalog.
- Build artifacts (`itemdumper/build`, `.gradle`, `run`) are gitignored; the
  gradle wrapper jar IS committed.

## Git, identity, and GitHub Pages deploy

- Repo: `https://github.com/newcarrotgames/enchantcalc` (public). Live site:
  `https://newcarrotgames.github.io/enchantcalc/`.
- **NEVER let any commit reference a work account.** The repo had to be deleted
  and recreated once over a leaked work email. Commit identity is pinned per-repo
  via local config to `New Carrot Games <newcarrotgames@gmail.com>`; verify with
  `git config user.email` before committing. GitHub attributes commits by email.
- This shell wraps `git commit` and injects a `--trailer` flag that the local
  git 2.25.1 does not support, so plain `git commit` fails with
  "unknown option `trailer'". Work around it by committing with the real binary:
  **`/usr/bin/git commit ...`** (other git subcommands are unaffected).
- **Pages deploys from the `gh-pages` branch** (legacy/branch mode), NOT GitHub
  Actions. The `gh` token lacks the `workflow` scope, so pushing
  `.github/workflows/deploy.yml` is rejected. That file is kept on disk but is
  gitignored (`.github/workflows/`) and `deploy.yml` is purged from history.
  To redeploy after changes: `npm run build`, then commit `dist/` contents onto a
  fresh `gh-pages` branch and force-push it (with the New Carrot Games identity
  via `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env vars). To switch back to Actions,
  grant the scope (`gh auth refresh -h github.com -s workflow`), un-ignore and
  commit the workflow, and set Pages source back to "GitHub Actions".

## Conventions

- After substantive edits run `npm test` and `npm run build`; both must be green.
- When adding catalog data, prefer verifying against the local install or wiki,
  and document the source in code comments (the scripts already cite sources).
- Markdown/docs: avoid em dashes and en dashes; use hyphens, commas, or
  parentheses instead.
