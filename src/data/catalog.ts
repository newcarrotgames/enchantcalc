import type {
  BaubleDef,
  BaubleSlot,
  EnchantDef,
  EnchantTag,
  ItemDef,
  Pack,
} from '../types';
import itemsRaw from './items.json';
import enchantsRaw from './enchants.json';
import baublesRaw from './baubles.json';

export const ITEMS: ItemDef[] = itemsRaw as ItemDef[];
export const ENCHANTS: EnchantDef[] = enchantsRaw as EnchantDef[];
export const BAUBLES: BaubleDef[] = baublesRaw as BaubleDef[];

const itemsById = new Map(ITEMS.map((i) => [i.id, i]));
const enchantsById = new Map(ENCHANTS.map((e) => [e.id, e]));
const baublesById = new Map(BAUBLES.map((b) => [b.id, b]));

export function getItem(id: string | null | undefined): ItemDef | undefined {
  return id ? itemsById.get(id) : undefined;
}

export function getEnchant(id: string): EnchantDef | undefined {
  return enchantsById.get(id);
}

export function getBauble(id: string | null | undefined): BaubleDef | undefined {
  return id ? baublesById.get(id) : undefined;
}

/** True when a bauble can be equipped into the given bauble slot. */
export function baubleFitsSlot(bauble: BaubleDef, slot: BaubleSlot): boolean {
  if (bauble.baubleType === 'any') return true;
  if (bauble.baubleType === 'ring') return slot === 'ring1' || slot === 'ring2';
  return bauble.baubleType === slot;
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
