#!/usr/bin/env bash
# Builds the itemdumper Forge mod and installs the jar into the RLCraft Dregora
# (Local Dev) mods folder. Run from anywhere:  ./itemdumper/build-and-install.sh
set -euo pipefail

# Resolve this script's directory so the script is location-independent.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1.12.2 / ForgeGradle 2.3 must build under a Java 8 JDK.
JAVA8_HOME="${JAVA8_HOME:-/usr/lib/jvm/java-8-openjdk-amd64}"
if [[ ! -x "$JAVA8_HOME/bin/javac" ]]; then
  echo "ERROR: Java 8 JDK not found at '$JAVA8_HOME'." >&2
  echo "Set JAVA8_HOME to a Java 8 JDK and re-run." >&2
  exit 1
fi

# Destination mods folder (override with MODS_DIR=... if the path differs).
MODS_DIR="${MODS_DIR:-/mnt/d/curseforge/minecraft/Instances/RLCraft Dregora (Local Dev)/mods}"

echo "==> Building itemdumper (JAVA_HOME=$JAVA8_HOME)"
( cd "$SCRIPT_DIR" && JAVA_HOME="$JAVA8_HOME" ./gradlew build --no-daemon )

# Pick the built mod jar (exclude the -sources jar).
JAR="$(ls -1 "$SCRIPT_DIR"/build/libs/itemdumper-*.jar 2>/dev/null | grep -v -- '-sources' | head -n1 || true)"
if [[ -z "$JAR" ]]; then
  echo "ERROR: no built jar found in $SCRIPT_DIR/build/libs" >&2
  exit 1
fi

if [[ ! -d "$MODS_DIR" ]]; then
  echo "ERROR: mods folder not found:" >&2
  echo "  $MODS_DIR" >&2
  echo "Set MODS_DIR=... to the correct path and re-run." >&2
  exit 1
fi

# Remove any previously installed itemdumper jars so versions don't pile up.
rm -f "$MODS_DIR"/itemdumper-*.jar

cp "$JAR" "$MODS_DIR/"
echo "==> Installed $(basename "$JAR") to:"
echo "    $MODS_DIR"
