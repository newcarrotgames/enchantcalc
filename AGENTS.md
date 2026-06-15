# AGENTS.md

Context for AI agents working on the **RLCraft Enchant Calculator**. Read this
before making changes - especially the "Data is generated" and "Game mechanics"
sections, which encode hard-won, verified facts about RLCraft.

## What this project is

A Minecraft-styled, static web app for RLCraft (and RLCraft Dregora) players.
Drag items + enchants onto a build board and see weapon damage ranges and armor
damage reduction. Pure, unit-tested calculation engine; everything ships static.

- Stack: React 18 + TypeScript + Vite, `@dnd-kit` (drag/drop), `zustand` (state),
  `three` + `skinview3d` (the 3D center character), Vitest (tests). Node v20.18.2 -
  toolchain versions are pinned in `package.json` for this Node; do not bump blindly.
  Note: `skinview3d` bundles its own (older) `@types/three`, which clashes with the
  root `@types/three` at the `Object3D.add` boundary - `CharacterModel.tsx` bridges
  the two copies with a small structural `Addable` cast rather than `any`.
- `base: './'` so `dist/` deploys to any static host.

## Commands

```bash
npm run dev      # dev server (note: may land on 5174 if 5173 is taken)
npm test         # vitest run (engine tests)
npm run build    # tsc -b && vite build  (always run before declaring done)
node scripts/generateItems.mjs     # regenerate src/data/items.json
node scripts/generateEnchants.mjs  # regenerate src/data/enchants.json
node scripts/generateBaubles.mjs   # regenerate src/data/baubles.json (from the dump)
node scripts/extractIcons.mjs      # re-extract real sprites (needs local install)
```

## Architecture

```
scripts/       generateItems.mjs, generateEnchants.mjs, generateBaubles.mjs  <- SOURCE OF TRUTH for data
               crossReferenceItems.mjs (diff in-game dump vs catalog)
               baublesDump.json, armorDump.json (committed dump snapshots)
itemdumper/    Forge 1.12.2 mod that dumps in-game item stats to JSON (see below)
src/
  data/        items.json, enchants.json, baubles.json (GENERATED), catalog.ts (typed accessor)
  engine/      weapon.ts, armor.ts, incompat.ts, baubles.ts (pure functions) + __tests__/
  store/       buildStore.ts (zustand), urlState.ts (shareable URL hash)
  components/  App, ItemBrowser, BuildBoard, CharacterModel, StatsPanel, icons, MCTooltip
  types.ts     shared domain types (ItemDef, EnchantDef, BaubleDef, BuildState, BaubleState, ...)
```

### UI layout (RLCraft-inventory style)

The workspace is a 3-column grid (`.workspace` in `src/ui.css`):

- LEFT `ItemBrowser` - one JEI-style catalog panel (search on top, Items/Enchants/
  Baubles tabs + pack/category filters, a flat icon grid). It replaced the three
  separate palettes (ItemPalette/EnchantPalette/BaublePalette, now deleted); all
  three draggable types live here. Drag-and-drop ids are unchanged
  (`item:`/`enchant:`/`bauble:`), so the `DndContext` handlers in `App.tsx` are
  untouched.
- CENTER `BuildBoard` - the inventory panel: armor + mainhand equip slots (left
  column) and a two-column baubles + off-hand grid (right) flank `CharacterModel`.
  The right grid mirrors the in-game RLCraft Baubles layout, row-major:
  `Amulet|Head, Ring|Body, Ring|Charm, Belt|Off hand` (the `RIGHT_GRID` array in
  `BuildBoard.tsx`). Equip slots are compact; clicking one selects it and the
  `EnchantEditor` below shows that slot's `EnchantChips` (+/- and remove).
  Droppable ids stay `slot:<slot>` / `bauble:<slot>`.
- `offhand` is an `EquipSlot` (added alongside `mainhand`). It accepts main-hand
  items (weapons/shields) - `store.setItem` special-cases it. The off hand is
  plumbed through state and the shareable URL (`urlState.ALL_SLOTS`/`emptyBuild`),
  but its combat effects are NOT modelled yet: `computeArmor` iterates the fixed
  First Aid `REGIONS` (helmet/chest/legs/boots) and `computeWeapon` reads only
  `mainhand`, so an off-hand item currently changes nothing numerically. Modelling
  off-hand effects (shield block reduction, dual-wield, totems, etc.) is a
  follow-up that needs verified per-item data.
- RIGHT `StatsPanel` - the same weapon/armor math, with headline numbers rendered
  as potion-effect-style `.buff-card`s on top of the existing detail rows/table.

`CharacterModel` renders a generic Minecraft figure via `skinview3d` on a `<canvas>`.
The default skin is **generated at runtime** on a 2D canvas (no bundled binary skin
asset; fully static/offline) - swap in a real texture later if desired. It does NOT
render textured armor layers (those mod body textures aren't extracted); instead it
shows simple translucent per-region highlights (helmet->head, chestplate->body+arms,
leggings->upper legs, boots->lower legs) toggled by which slots are filled. If WebGL
is unavailable the component falls back to a text placeholder. `skinview3d` also ships
a real `minecraft.woff2` font in its package (unused; `VT323`/`Press Start 2P` from
Google Fonts remain the UI faces).

## Data is generated - DO NOT hand-edit the JSON

`src/data/items.json` (~701 entries), `src/data/enchants.json` (~103 entries),
and `src/data/baubles.json` (~89 entries) are produced by the scripts in
`scripts/`. To change catalog data, edit the data arrays in those scripts and
re-run them, then `npm run build`. Hand-edits to the JSON will be wiped on the
next regen.

- **Weapons** are config/wiki-derived in `generateItems.mjs`. **Armor (~207
  pieces) is derived from the in-game dump** by `generateArmorFromDump()` in the
  same script: it reads `itemdump.json` (live install) or the committed snapshot
  `scripts/armorDump.json`, takes each wearable piece's real vanilla armor
  points + toughness, groups pieces into sets by their in-game display name, and
  collapses identical-stat color variants (the ~30 Dragon Scale colors, 7 Tide
  Guardian colors -> one each; a small color-word strip also folds Tan/White/Red
  Death Worm Chitin together). It skips 0-point cosmetics (lifebelt, blindfold,
  earplugs) and any piece already in the bauble catalog (Quark hats), so the same
  item is not listed twice. Set bonuses/flavor live in the `SET_NOTES` map.
- Item IDs are `type_material` for weapons (e.g. `katana_iron`,
  `katana_fire_dragonbone`) and `set_slot` for armor (e.g. `diamond_helmet`).
  Vanilla armor keeps its registry-path id (`iron_helmet`, `chainmail_leggings`);
  modded armor uses `<setslug>_<slot>` (e.g. `dragonscale_helmet`,
  `neptunium_boots`), mod-prefixed on a clash. Each armor item carries its
  `registryName` (used for icon extraction + cross-ref).
  Vanilla weapons keep simple IDs (`iron_sword`, `diamond_axe`, `fist`).
  Bauble IDs are `bauble_<modid>_<path>` derived from the registry name
  (e.g. `bauble_artifacts_power_glove`).
- Icon field is **`shape:material`** (colon-separated, e.g. `sword:iron`,
  `chestplate:diamond`). Material may contain underscores. Baubles use a
  `<shape>:default` icon where shape is the slot type (ring/amulet/belt/charm).
- Item/bauble icons render the **real in-game sprites** in
  `src/assets/item-icons/<id>.png`, extracted from the modpack jars by
  `scripts/extractIcons.mjs` (GENERATED; do not hand-edit). `ItemIcon` looks up
  the PNG by id and falls back to the procedural `shape:material` SVGs in
  `src/components/icons.tsx` when no sprite exists. Armor sprites resolve
  generically via each item's `registryName` (`assets/<modId>/textures/items/
  <path>.png`; Minecraft uses `gold` where the path says `golden`), so new armor
  needs no per-set mapping; only the Savage & Ravage / Lavacow sets (textures not
  in the jars) and a few cosmetics fall back to SVG. When adding items/baubles,
  re-run `extractIcons.mjs`; add new SVG shapes/material colors only as a fallback.
- Optional `group` field controls the palette accordion section (baubles group
  by slot type: Rings, Amulets, Belts, etc.).

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

This reproduces the wiki's published locational numbers (the dump even prints
the locational value in each piece's tooltip, used as a sanity check). Per
region, layers combine
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

### Baubles (RLCraft Baubles mod)

7 accessory slots (`amulet`, `ring1`, `ring2`, `belt`, `head`, `body`, `charm`)
held in a separate `BaubleState` map alongside `BuildState`. A `BaubleDef` has a
`baubleType` (`amulet|ring|belt|head|body|charm|any`); a `ring` fits either ring
slot and an `any`-type bauble fits any slot (`baubleFitsSlot` in `catalog.ts`).
Baubles are NOT enchantable.

Baubles are **global buffs**: `engine/baubles.ts` `aggregateBaubleBonuses()`
sums the equipped baubles' effects into a `BaubleBonuses` object that is passed
as an optional 3rd arg into both `computeWeapon` and `computeArmor`. A bauble can
carry several effects at once (`effects: EnchantEffect[]`), reusing the enchant
effect shape (level fixed at 1) plus bauble-only kinds: `damageMultiplier`,
`locationalArmor` (added to the region matching the bauble's slot - head/body
only), `resistance` (Resistance levels, stacks with the potion knob), `maxHp`.
Only ~9 baubles carry verified math; the rest are `info`. There are no
incompatibility groups for baubles.

Verified numeric baubles and sources: RLArtifacts Power/Mechanical Glove, Fire
Gauntlet (+3 attack damage, op 0) and Feral Claws/Mechanical Glove/Fire Gauntlet
(+20% attack speed, op 1) from `config/RLArtifacts.cfg`; Wrath Pendant (+2 dmg),
Quark hats (+7 locational armor on head), Obsidian Skull (50% fire reduction)
from in-game tooltips. Do not invent magnitudes the dump/config don't give -
ship unverified baubles as `info`.

## Verified RLCraft facts (don't regress these)

- **Dragonsteel armor does NOT exist.** The pack uses the "I&F: RLCraft Edition"
  fork of Ice and Fire (`Ice and Fire-2.0.9.jar`), which has no dragonsteel.
  Dragon Scale is the top dragon armor: vanilla **5/9/7/5**, toughness 2 (per the
  dump; an earlier hand-derived 4/9/7/4 was wrong). All ~30 color variants share
  these stats.
- **Golem armor** (Forgotten Items) is vanilla 5/8/6/4, toughness **4** (per the
  dump; an earlier 4.5 was wrong).
- **Steel armor exists** (`rlmixins:steel_*`, RLMixins) as a full 4-piece set
  (3/7/5/3), between iron and diamond, with the "Flame Hardened" set bonus.
- **Myrmex Chitin** (Desert + Jungle) is a full 4-piece set (4/8/5/3), on par
  with diamond.
- Armor stats are now taken straight from the in-game dump (not hand-derived);
  `crossReferenceItems.mjs` shows 0 armor stat mismatches against the dump.
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
  display name (Minecraft `§` formatting codes stripped) and reports stat
  mismatches, catalog items not found in game (possible phantom material/weapon
  combos), and in-game combat items missing from the catalog.
- Build artifacts (`itemdumper/build`, `.gradle`, `run`) are gitignored; the
  gradle wrapper jar IS committed.

The **armor catalog is derived from the dump** the same way: `generateItems.mjs`
(`generateArmorFromDump()`) reads `itemdump.json` (filter `all`), keeps every
wearable `ItemArmor` piece with armor points, and writes the deduped list to the
committed snapshot `scripts/armorDump.json` (live dump preferred, snapshot
fallback). Unlike baubles, armor stats (points + toughness) ARE machine-readable
in the dump, so no hand-encoding is needed.

The bauble catalog is **derived from the dump**: `generateBaubles.mjs` reads
`itemdump.json` (filter `all`), keeps every item with a `"Bauble (X)"` tooltip
line, and writes the list (plus `translationKey`, used to recover snake_case
texture names) to the committed snapshot `scripts/baublesDump.json`. If the live
dump is absent it falls back to that snapshot, so regen works without the install.
The dump gives names/slot types/tooltips but NOT structured effect magnitudes
(bauble effects are custom-coded, not attribute modifiers), so combat numbers are
hand-encoded from configs/tooltips in the script's `EFFECTS` map and cited. Source
mods: Bountiful Baubles, RLArtifacts (`artifacts`), Trinkets and Baubles (`xat`),
core Baubles, plus odds and ends (Quark hats, etc.).

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
  To redeploy after changes, run `./scripts/deploy-pages.sh` (it builds, pins the
  New Carrot Games identity, commits `dist/` onto a fresh `gh-pages` branch via a
  throwaway repo, and force-pushes). Manual equivalent: `npm run build`, then
  commit `dist/` contents onto a fresh `gh-pages` branch and force-push it (with
  the New Carrot Games identity via `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env vars).
  Note: a `main` push does NOT update the site; only `gh-pages` does. To switch back to Actions,
  grant the scope (`gh auth refresh -h github.com -s workflow`), un-ignore and
  commit the workflow, and set Pages source back to "GitHub Actions".

## Conventions

- **Keep this file (AGENTS.md) up to date automatically.** Whenever a change
  invalidates or extends something documented here (new/renamed scripts or
  commands, architecture or data-flow changes, new tooling, toolchain/version
  pins, deploy process, or any newly verified game-mechanics fact), update the
  relevant section in the same change. Treat AGENTS.md as part of the deliverable,
  not an afterthought: do not wait to be asked. Prefer correcting stale guidance
  over appending duplicates, and cite sources for new mechanics facts.
- After substantive edits run `npm test` and `npm run build`; both must be green.
- When adding catalog data, prefer verifying against the local install or wiki,
  and document the source in code comments (the scripts already cite sources).
- Markdown/docs: avoid em dashes and en dashes; use hyphens, commas, or
  parentheses instead.
