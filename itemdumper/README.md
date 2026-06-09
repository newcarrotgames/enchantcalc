# itemdumper

A tiny Minecraft 1.12.2 / Forge mod that dumps every registered item's real
in-game stats to JSON, so the enchant calculator catalog (`src/data/items.json`)
can be cross-referenced against ground truth instead of hand-derived numbers.

It adds one server command, `/dumpitems`, which walks the entire item registry,
enumerates every creative sub-item, and writes their stats (attack damage/speed,
armor points/toughness, durability, mod id, creative tab, food values,
enchantability, item class) to a JSON file.

## Why a separate Forge build version

- The pack runs **Forge 14.23.5.2860**, but that build (and 2855) only publish a
  `userdev3` artifact, which ForgeGradle 2.3 cannot consume.
- So the mod is **compiled against Forge 14.23.5.2847** (the last 1.12.2 build
  that ships the `userdev` artifact FG 2.3 needs). The resulting jar is
  ABI-compatible and runs fine on the pack's 2860 runtime.

## Build

Requires a **Java 8 JDK** (1.12.2 / ForgeGradle 2.3 will not build on newer
JDKs). The gradle wrapper is pinned to Gradle 4.10.3.

```bash
cd itemdumper
JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64 ./gradlew build
```

The first build downloads Forge and decompiles Minecraft (slow, network-heavy).
Output jar: `build/libs/itemdumper-1.0.0.jar`.

## Use

1. Copy `build/libs/itemdumper-1.0.0.jar` into the pack's `mods/` folder:
   `/mnt/d/curseforge/minecraft/Instances/RLCraft Dregora (Local Dev)/mods/`
2. Launch the game and load any world (enable cheats / be op so you can run
   commands; the command needs permission level 2).
3. Run one of:
   - `/dumpitems` - every item (large)
   - `/dumpitems combat` - weapons + armor only (recommended for cross-ref)
   - `/dumpitems weapons` / `/dumpitems armor`
4. The dump is written to `<gamedir>/itemdumps/itemdump[-filter].json` and the
   absolute path is printed in chat.

## Cross-reference against the catalog

From the project root:

```bash
node scripts/crossReferenceItems.mjs --dump "/mnt/d/curseforge/minecraft/Instances/RLCraft Dregora (Local Dev)/itemdumps/itemdump.json"
```

(The default `--dump` path already points there.) The script matches catalog
items to in-game items by normalized display name and reports:

- stat mismatches (catalog vs in-game damage/speed/armor/toughness),
- catalog items not found in game (possible phantom material/weapon combos),
- in-game weapons/armor missing from the catalog (coverage gaps).

Add `--json report.json` to also write a machine-readable report.

## Output shape

```json
{
  "meta": { "generator": "itemdumper 1.0.0", "filter": "combat", "itemCount": 0 },
  "items": [
    {
      "registryName": "spartanweaponry:dagger_iron",
      "modId": "spartanweaponry",
      "path": "dagger_iron",
      "metadata": 0,
      "displayName": "Iron Dagger",
      "translationKey": "item.spartanweaponry.dagger_iron",
      "itemClass": "...",
      "maxStackSize": 1,
      "durability": 250,
      "enchantability": 14,
      "creativeTab": "...",
      "attackDamageModifier": 2.0,
      "attackDamage": 3.0,
      "attackSpeed": 2.5
    }
  ]
}
```

Armor entries add `armorSlot`, `armorPoints`, `toughness`; food adds
`foodHealAmount`, `foodSaturation`. The `attackDamage` / `attackSpeed` values
fold in the player base (1.0 damage, 4.0 speed), matching the in-game tooltip.
