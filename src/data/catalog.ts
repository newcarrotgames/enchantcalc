import type { EnchantDef, EnchantTag, ItemDef, Pack } from '../types';
import itemsRaw from './items.json';
import enchantsRaw from './enchants.json';

export const ITEMS: ItemDef[] = itemsRaw as ItemDef[];
export const ENCHANTS: EnchantDef[] = enchantsRaw as EnchantDef[];

const itemsById = new Map(ITEMS.map((i) => [i.id, i]));
const enchantsById = new Map(ENCHANTS.map((e) => [e.id, e]));

export function getItem(id: string | null | undefined): ItemDef | undefined {
  return id ? itemsById.get(id) : undefined;
}

export function getEnchant(id: string): EnchantDef | undefined {
  return enchantsById.get(id);
}

/** True when an enchant can be applied to an item (tag intersection). */
export function enchantAppliesToItem(enchant: EnchantDef, item: ItemDef): boolean {
  return enchant.appliesTo.some((tag) => item.accepts.includes(tag));
}

export function tagsIntersect(a: EnchantTag[], b: EnchantTag[]): boolean {
  return a.some((t) => b.includes(t));
}

/**
 * Dregora is built on top of RLCraft, so selecting it should also surface the
 * vanilla + RLCraft catalog. Vanilla is always visible.
 */
export function packMatchesFilter(pack: Pack, filter: Pack | 'all'): boolean {
  if (filter === 'all') return true;
  if (filter === 'dregora') return true; // Dregora = vanilla + rlcraft + dregora
  if (filter === 'rlcraft') return pack === 'vanilla' || pack === 'rlcraft';
  return pack === 'vanilla';
}
