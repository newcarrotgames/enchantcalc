# RLCraft Enchant Calculator

A Minecraft-styled web app for [RLCraft](https://rlcraft.wiki.gg/) (and RLCraft
Dregora) players. Drag items and enchants onto a build board and instantly see:

- Weapon damage output as a min-max range (with DPS and per-enchant breakdown)
- Armor damage reduction and effective HP, using RLCraft's layered, locational model

Built with React + TypeScript + Vite, drag-and-drop via `@dnd-kit`, state via
`zustand`, and a pure, unit-tested calculation engine. It ships as a static site.

## Quick start

```bash
npm install
npm run dev      # local dev server
npm test         # run the engine unit tests
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build
```

The build is fully static (`base: './'`), so `dist/` can be dropped onto GitHub
Pages, Netlify, or any static host with no extra configuration.

## How to use

1. Pick a pack filter (Vanilla / RLCraft / Dregora). Dregora is built on RLCraft,
   so it shows the vanilla + RLCraft catalog.
2. Drag a weapon onto the weapon slot and armor pieces onto their slots (or click
   an item to equip it).
3. Drag enchants onto an item (or click an enchant to auto-apply it to the first
   compatible equipped item). Incompatible enchants (e.g. Sharpness vs Smite) are
   blocked with a notice.
4. Adjust enchant levels with the +/- controls.
5. Read the damage range on the right. For armor, set the incoming hit size,
   damage type, and Resistance level to see the reduction and effective HP.
6. Use "Share build" to copy a URL that encodes the entire loadout.

## Combat model

This is a best-effort model of RLCraft 2.9.x combat. RLCraft combat is intricate;
the numbers are meant for comparing builds, not as exact in-game values.

### Weapon damage (`src/engine/weapon.ts`)

Order of operations (Minecraft 1.12): base attack damage, then x1.5 on a critical
hit, then flat enchant damage is added (Sharpness-type bonuses are not multiplied
by the crit).

- `min` = no crit, no situational bonus, no unarmored multiplier
- `max` = critical hit, plus the best situational enchant (e.g. Smite vs undead),
  plus any weapon multiplier (e.g. the katana's 1.5x vs targets with no chestplate)

RLCraft Sharpness tiers used:

| Enchant            | Flat damage          |
| ------------------ | -------------------- |
| Lesser Sharpness   | 0.25 + 0.25 x Level  |
| Sharpness          | 0.5 + 0.5 x Level    |
| Advanced Sharpness | 1.25 + 0.95 x Level  |
| Supreme Sharpness  | 4 + 1.6 x Level      |

### Armor / damage reduction (`src/engine/armor.ts`)

RLCraft uses the **First Aid** mod, so damage is **locational**: the body is split
into regions, each protected by exactly one piece (helmet -> head, chestplate ->
body + both arms, leggings -> legs, boots -> feet). Each piece's vanilla armor
points are scaled into "locational armor" for its region (values from
`config/firstaid.cfg`):

```
locationalArmor = vanillaArmorPoints x multiplier + offset
  head  x4 +3    chest x2 +3    legs x2 +4    feet x3 +3   (toughness x1 +0)
```

This reproduces the wiki's published locational numbers exactly (e.g. Dragon Scale
4/9/7/4 vanilla -> 19/21/18/15 locational). Per region, reductions then layer
multiplicatively, each capped at 80%:

1. **Resistance** potion (20% per level, global)
2. **Protection enchants on that piece** (First Aid LOCAL_ENCHANTMENTS mode):
   vanilla EPF x a per-enchant local multiplier (Protection x4, Projectile/Blast/
   Fire x2), plus RLCraft percentage protections (Advanced / Physical / Magic at
   24%/level)
3. **Locational armor + toughness** via the vanilla formula
   `reduction = min(20, max(LA/5, LA - hit / (2 + LT/4))) / 25`

Damage typing: armor mitigates physical, projectile and blast, but not raw magic
or fire-tick (those rely on the matching protection enchant).

The panel shows each body region's locational armor and reduction, flags Head and
Body as the critical (lethal) parts, and gives a **hit-weighted** overall figure
(weights 1/3/2/2 for head / body+arms / legs / feet, since the chestplate covers
three of the eight limbs).

### Known simplifications

- Armor is modelled per body region (locational), but the overall number is a
  hit-weighted average rather than a simulation of First Aid's exact per-hit limb
  selection and per-limb HP pools.
- Damage-over-time enchants (the Fire Aspect family, Envenomed) are estimated in
  a separate "Damage over time" figure, not folded into the per-hit range, since
  they tick over time, do not crit or scale with attack speed, and are often
  resisted (fire-immune mobs, poison capping the target at 1 HP, chance to apply).
- Purely chance-based or cosmetic enchants (Critical Strike, Thorns, Lifesteal,
  etc.) are listed for reference but not added to the numeric range.
- Mob-specific and environmental modifiers are surfaced as the "situational"
  bonus in the max value rather than per-mob.

## Catalog data

The catalog (503 items, 103 enchants) is **generated** from the RLCraft Dregora
game files plus the wiki, so it can be re-derived and expanded deterministically.

```bash
node scripts/generateItems.mjs     # writes src/data/items.json
node scripts/generateEnchants.mjs  # writes src/data/enchants.json
```

### Weapons (the Spartan Weaponry matrix)

`scripts/generateItems.mjs` encodes the weapon-type table straight from
`config/spartanweaponry.cfg` and applies the mod's own damage formula:

```
attackDamage = damageMultiplier x materialBaseDamage + weaponDamageBase
```

Material base damages come from the config `materials` block (native metals) and
from the wiki katana table for modded materials. Because damage is linear in the
material base, every material's base is a single constant applied across all 21
weapon types - the derived values match the config exactly where they overlap
(silver 1.5, steel 2.5, bronze 2.0, ...). Modded materials (dragonbone family,
umbrium, myrmex family) are only generated for the weapon types the Spartan Fire /
Spartan Defiled addons register.

### Armor data

All armor stores **vanilla armor points** (one consistent scale); the engine
derives First Aid locational armor from them at calculation time (see above). This
covers all vanilla sets plus modded sets - Dragon Scale and Desert/Jungle Myrmex
Chitin (full 4-piece sets) - with values back-derived from the wiki's locational
numbers.

Note: **Dragonsteel armor does not exist in RLCraft.** The pack ships the "I&F:
RLCraft Edition" fork of Ice and Fire (verified against the local install,
`Ice and Fire-2.0.9.jar`), which has no dragonsteel items; Dragon Scale is the top
dragon armor.

## Extending the catalog

Edit the data arrays in the generator scripts and re-run them, or edit the JSON
directly. Each entry needs:

- **Items** (`src/data/items.json`): `id`, `name`, `pack`, `category`
  (`weapon` | `armor`), `slot`, `icon`, optional `group` (palette section), and
  stats (`baseDamage` + `attackSpeed` for weapons; `armorPoints` + `toughness` for
  armor). `accepts` lists the enchant tags the item can take.
- **Enchants** (`src/data/enchants.json`): `id`, `name`, `pack`, `maxLevel`,
  `appliesTo` tags, an `effect` (see below), and `incompatibleGroups` (enchants
  sharing a group id are mutually exclusive on one item).
- **Icons**: the `icon` field is `shape:material` (e.g. `sword:iron`,
  `chestplate:diamond`). Shapes and material colors are defined procedurally in
  `src/components/icons.tsx` - add new shapes/materials there.

Effect kinds:

- `flatDamage`: `{ base, perLevel, condition? }` -> damage = base + perLevel x level
- `percentReduction`: `{ perLevelPct, cap, damageType? }` (RLCraft % protections)
- `vanillaProtection`: `{ epfPerLevel, damageType? }` (EPF system)
- `info`: listed only, no numeric effect

Type definitions are in `src/types.ts`.

## Sources

- RLCraft Wiki - Enchanting: https://rlcraft.wiki.gg/wiki/Enchanting
- RLCraft Wiki - Incompatible Enchantments: https://rlcraft.wiki.gg/wiki/Incompatible_Enchantments
- RLCraft Wiki - Katana: https://rlcraft.wiki.gg/wiki/Katana
- RLCraft Wiki - First Aid / Locational Damage: https://rlcraft.wiki.gg/wiki/First_Aid
- RLCraft Wiki - Dragon Scale Armor: https://rlcraft.wiki.gg/wiki/Dragon_Scale_Armor
- RLCraft Wiki - Myrmex Chitin: https://rlcraft.fandom.com/wiki/Myrmex_Chitin
- Minecraft Wiki - Damage / Armor: https://minecraft.wiki/w/Damage
- Local RLCraft Dregora install: `config/spartanweaponry.cfg`, `config/somanyenchantments.cfg`,
  and the Spartan Weaponry / Spartan Fire / Spartan Defiled mod jars (lang files)

## Project layout

```
scripts/       generateItems.mjs, generateEnchants.mjs (catalog generators)
src/
  data/        items.json, enchants.json, typed catalog accessor
  engine/      pure calc functions (weapon, armor, incompat) + tests
  store/       zustand build store + URL state (de)serialization
  components/  BuildBoard, palettes, StatsPanel, tooltips, icons
  types.ts     shared domain types
```

Each enchant entry carries a `source` URL so values can be verified and corrected
as the model is refined against in-game testing.
