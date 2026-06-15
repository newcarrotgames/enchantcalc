import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type {
  BaubleDef,
  BaubleSlot,
  EnchantDef,
  EnchantTag,
  EquipSlot,
  ItemCategory,
  ItemDef,
} from '../types';
import { ARMOR_SLOTS, BAUBLE_SLOTS } from '../types';
import {
  BAUBLES,
  ENCHANTS,
  ITEMS,
  baubleFitsSlot,
  enchantAppliesToItem,
  getItem,
  packMatchesFilter,
} from '../data/catalog';
import { checkCompatibility } from '../engine';
import { useBuildStore, type PackFilter } from '../store/buildStore';
import { EnchantIcon, ItemIcon } from './icons';
import { Tooltip } from './MCTooltip';
import {
  BaubleTooltip,
  EnchantTooltip,
  ItemTooltip,
  roman,
} from './BuildBoard';

type Tab = 'items' | 'enchants' | 'baubles';
type CategoryFilter = 'all' | ItemCategory;
type TargetFilter = 'all' | 'weapon' | 'armor';

const PACKS: { id: PackFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'vanilla', label: 'Vanilla' },
  { id: 'rlcraft', label: 'RLCraft' },
  { id: 'dregora', label: 'Dregora' },
];

const WEAPON_TAGS: EnchantTag[] = ['weapon', 'sword', 'axe', 'bow', 'tool', 'shield'];

function enchantTarget(def: EnchantDef): 'weapon' | 'armor' {
  return def.appliesTo.some((t) => WEAPON_TAGS.includes(t)) ? 'weapon' : 'armor';
}

export function ItemBrowser() {
  const packFilter = useBuildStore((s) => s.packFilter);
  const setPackFilter = useBuildStore((s) => s.setPackFilter);
  const [tab, setTab] = useState<Tab>('items');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [target, setTarget] = useState<TargetFilter>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const items = useMemo(
    () =>
      ITEMS.filter(
        (i) =>
          packMatchesFilter(i.pack, packFilter) &&
          (category === 'all' || i.category === category) &&
          (q === '' ||
            i.name.toLowerCase().includes(q) ||
            (i.mod ?? '').toLowerCase().includes(q) ||
            (i.group ?? '').toLowerCase().includes(q)),
      ),
    [packFilter, category, q],
  );

  const enchants = useMemo(
    () =>
      ENCHANTS.filter(
        (e) =>
          packMatchesFilter(e.pack, packFilter) &&
          (target === 'all' || enchantTarget(e) === target) &&
          (q === '' ||
            e.name.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            (e.mod ?? '').toLowerCase().includes(q)),
      ),
    [packFilter, target, q],
  );

  const baubles = useMemo(
    () =>
      BAUBLES.filter(
        (b) =>
          packMatchesFilter(b.pack, packFilter) &&
          (q === '' ||
            b.name.toLowerCase().includes(q) ||
            (b.mod ?? '').toLowerCase().includes(q) ||
            b.description.toLowerCase().includes(q) ||
            (b.group ?? '').toLowerCase().includes(q)),
      ),
    [packFilter, q],
  );

  const count =
    tab === 'items'
      ? items.length
      : tab === 'enchants'
      ? enchants.length
      : baubles.length;

  return (
    <div className="panel mc-bevel browser">
      <div className="panel-title">
        <span>Catalog</span>
        <span className="count-pill">{count}</span>
      </div>

      <input
        className="search-input"
        type="search"
        placeholder="Search the catalog..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="browser-tabs">
        {(['items', 'enchants', 'baubles'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`mc-btn${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'items' ? 'Items' : t === 'enchants' ? 'Enchants' : 'Baubles'}
          </button>
        ))}
      </div>

      <div className="filter-row">
        {PACKS.map((p) => (
          <button
            key={p.id}
            className={`mc-btn${packFilter === p.id ? ' is-active' : ''}`}
            onClick={() => setPackFilter(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="filter-row">
          {(['all', 'weapon', 'armor'] as CategoryFilter[]).map((c) => (
            <button
              key={c}
              className={`mc-btn${category === c ? ' is-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c === 'all' ? 'All' : c === 'weapon' ? 'Weapons' : 'Armor'}
            </button>
          ))}
        </div>
      )}

      {tab === 'enchants' && (
        <div className="filter-row">
          {(['all', 'weapon', 'armor'] as TargetFilter[]).map((t) => (
            <button
              key={t}
              className={`mc-btn${target === t ? ' is-active' : ''}`}
              onClick={() => setTarget(t)}
            >
              {t === 'all' ? 'All' : t === 'weapon' ? 'Weapon' : 'Armor'}
            </button>
          ))}
        </div>
      )}

      <div className="browser-grid">
        {tab === 'items' &&
          items.map((item) => <BrowserItem key={item.id} item={item} />)}
        {tab === 'enchants' &&
          enchants.map((def) => <BrowserEnchant key={def.id} def={def} />)}
        {tab === 'baubles' &&
          baubles.map((b) => <BrowserBauble key={b.id} bauble={b} />)}
        {count === 0 && <div className="hint">Nothing matches.</div>}
      </div>
    </div>
  );
}

function BrowserItem({ item }: { item: ItemDef }) {
  const setItem = useBuildStore((s) => s.setItem);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item:${item.id}`,
    data: { type: 'item', id: item.id, slot: item.slot },
  });

  return (
    <Tooltip content={<ItemTooltip itemId={item.id} />}>
      <div
        ref={setNodeRef}
        className="inv-slot draggable"
        style={{ opacity: isDragging ? 0.4 : 1 }}
        onClick={() => setItem(item.slot, item.id)}
        {...listeners}
        {...attributes}
      >
        <ItemIcon icon={item.icon} id={item.id} size={40} />
      </div>
    </Tooltip>
  );
}

function autoApplyEnchant(def: EnchantDef): void {
  const store = useBuildStore.getState();
  const slots: EquipSlot[] = ['mainhand', ...ARMOR_SLOTS];
  for (const slot of slots) {
    const item = getItem(store.build[slot].itemId);
    if (!item) continue;
    if (!enchantAppliesToItem(def, item)) continue;
    if (!checkCompatibility(store.build[slot].enchants, def).ok) continue;
    store.addEnchant(slot, def.id);
    return;
  }
  useBuildStore.setState({
    notice: `No equipped item can take ${def.name}. Drag it onto a matching item.`,
  });
}

function BrowserEnchant({ def }: { def: EnchantDef }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `enchant:${def.id}`,
    data: { type: 'enchant', id: def.id },
  });

  return (
    <Tooltip content={<EnchantTooltip enchantId={def.id} />}>
      <div
        ref={setNodeRef}
        className="inv-slot draggable ench-tile"
        style={{ opacity: isDragging ? 0.4 : 1 }}
        onClick={() => autoApplyEnchant(def)}
        {...listeners}
        {...attributes}
      >
        <EnchantIcon def={def} size={34} />
        <span className="ench-tile-lvl">{roman(def.maxLevel)}</span>
      </div>
    </Tooltip>
  );
}

function autoEquipBauble(bauble: BaubleDef): void {
  const store = useBuildStore.getState();
  const fits = BAUBLE_SLOTS.filter((slot) => baubleFitsSlot(bauble, slot));
  const target =
    fits.find((slot) => !store.baubles[slot]) ?? (fits[0] as BaubleSlot | undefined);
  if (!target) {
    useBuildStore.setState({ notice: `${bauble.name} has no matching slot.` });
    return;
  }
  store.setBauble(target, bauble.id);
}

function BrowserBauble({ bauble }: { bauble: BaubleDef }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bauble:${bauble.id}`,
    data: { type: 'bauble', id: bauble.id, baubleType: bauble.baubleType },
  });

  return (
    <Tooltip content={<BaubleTooltip baubleId={bauble.id} />}>
      <div
        ref={setNodeRef}
        className="inv-slot draggable"
        style={{ opacity: isDragging ? 0.4 : 1 }}
        onClick={() => autoEquipBauble(bauble)}
        {...listeners}
        {...attributes}
      >
        <ItemIcon icon={bauble.icon} id={bauble.id} size={40} />
      </div>
    </Tooltip>
  );
}
