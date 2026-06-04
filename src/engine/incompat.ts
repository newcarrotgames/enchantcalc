import type { AppliedEnchant, EnchantDef } from '../types';
import { getEnchant } from '../data/catalog';

export interface ConflictResult {
  ok: boolean;
  reason?: string;
  conflictsWith?: EnchantDef;
}

/**
 * Determines whether `candidate` can be added to a slot that already has
 * `existing` enchants. An enchant conflicts if it is already present, or if it
 * shares an incompatibility group with an enchant already on the item (e.g.
 * only one of Sharpness / Smite / Bane may be present).
 */
export function checkCompatibility(
  existing: AppliedEnchant[],
  candidate: EnchantDef,
): ConflictResult {
  if (existing.some((a) => a.enchantId === candidate.id)) {
    return { ok: false, reason: `${candidate.name} is already applied.` };
  }

  if (candidate.incompatibleGroups.length === 0) return { ok: true };

  for (const a of existing) {
    const def = getEnchant(a.enchantId);
    if (!def) continue;
    const shared = def.incompatibleGroups.find((g) =>
      candidate.incompatibleGroups.includes(g),
    );
    if (shared) {
      return {
        ok: false,
        reason: `${candidate.name} is incompatible with ${def.name}.`,
        conflictsWith: def,
      };
    }
  }

  return { ok: true };
}
