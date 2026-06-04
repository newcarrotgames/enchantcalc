import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { ItemCategory, ItemDef } from '../types';
import { ITEMS, packMatchesFilter } from '../data/catalog';
import { useBuildStore, type PackFilter } from '../store/buildStore';
import { ItemIcon } from './icons';
import { Tooltip } from './MCTooltip';
import { ItemTooltip } from './BuildBoard';

type CategoryFilter = 'all' | ItemCategory;

const PACKS: { id: PackFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'vanilla', label: 'Vanilla' },
  { id: 'rlcraft', label: 'RLCraft' },
  { id: 'dregora', label: 'Dregora' },
];

interface Group {
  name: string;
  items: ItemDef[];
}

export function ItemPalette() {
  const packFilter = useBuildStore((s) => s.packFilter);
  const setPackFilter = useBuildStore((s) => s.setPackFilter);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const q = query.trim().toLowerCase();
  const searching = q !== '';

  const groups = useMemo<Group[]>(() => {
    const byName = new Map<string, ItemDef[]>();
    for (const i of ITEMS) {
      if (!packMatchesFilter(i.pack, packFilter)) continue;
      if (category !== 'all' && i.category !== category) continue;
      if (
        searching &&
        !i.name.toLowerCase().includes(q) &&
        !(i.mod ?? '').toLowerCase().includes(q) &&
        !(i.group ?? '').toLowerCase().includes(q)
      )
        continue;
      const key = i.group ?? 'Other';
      const list = byName.get(key);
      if (list) list.push(i);
      else byName.set(key, [i]);
    }
    return Array.from(byName, ([name, items]) => ({ name, items }));
  }, [packFilter, category, q, searching]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="panel mc-bevel">
      <div className="panel-title">
        <span>Items</span>
        <span className="count-pill">{total}</span>
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

      <input
        className="search-input"
        type="search"
        placeholder="Search items, type or mod..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="palette-scroll">
        {groups.map((g) => {
          const expanded = searching || open[g.name];
          return (
            <div key={g.name} className="palette-group">
              <button
                className="group-header"
                onClick={() => setOpen((o) => ({ ...o, [g.name]: !o[g.name] }))}
              >
                <span className="group-caret">{expanded ? '\u25be' : '\u25b8'}</span>
                <span className="group-name">{g.name}</span>
                <span className="count-pill">{g.items.length}</span>
              </button>
              {expanded && (
                <div className="palette-grid">
                  {g.items.map((item) => (
                    <PaletteItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <div className="hint">No items match.</div>}
      </div>
    </div>
  );
}

function PaletteItem({ item }: { item: ItemDef }) {
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
