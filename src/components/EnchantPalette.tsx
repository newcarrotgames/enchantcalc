import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { EnchantDef, EnchantTag, EquipSlot } from '../types';
import { ARMOR_SLOTS } from '../types';
import {
  ENCHANTS,
  enchantAppliesToItem,
  getItem,
  packMatchesFilter,
} from '../data/catalog';
import { checkCompatibility } from '../engine';
import { useBuildStore } from '../store/buildStore';
import { EnchantIcon } from './icons';
import { Tooltip } from './MCTooltip';
import { EnchantTooltip, roman } from './BuildBoard';

type TargetFilter = 'all' | 'weapon' | 'armor';

const WEAPON_TAGS: EnchantTag[] = ['weapon', 'sword', 'axe', 'bow', 'tool', 'shield'];

function targetOf(def: EnchantDef): 'weapon' | 'armor' {
  return def.appliesTo.some((t) => WEAPON_TAGS.includes(t)) ? 'weapon' : 'armor';
}

export function EnchantPalette() {
  const packFilter = useBuildStore((s) => s.packFilter);
  const [target, setTarget] = useState<TargetFilter>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = ENCHANTS.filter(
    (e) =>
      packMatchesFilter(e.pack, packFilter) &&
      (target === 'all' || targetOf(e) === target) &&
      (q === '' ||
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.mod ?? '').toLowerCase().includes(q)),
  );

  return (
    <div className="panel mc-bevel">
      <div className="panel-title">
        <span>Enchants</span>
      </div>
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
      <input
        className="search-input"
        type="search"
        placeholder="Search enchants..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="palette-grid enchants">
        {list.map((def) => (
          <PaletteEnchant key={def.id} def={def} />
        ))}
        {list.length === 0 && <div className="hint">No enchants match.</div>}
      </div>
    </div>
  );
}

function autoApply(def: EnchantDef): void {
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

function PaletteEnchant({ def }: { def: EnchantDef }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `enchant:${def.id}`,
    data: { type: 'enchant', id: def.id },
  });

  return (
    <Tooltip content={<EnchantTooltip enchantId={def.id} />}>
      <div
        ref={setNodeRef}
        className="ench-row"
        style={{ opacity: isDragging ? 0.4 : 1 }}
        onClick={() => autoApply(def)}
        {...listeners}
        {...attributes}
      >
        <EnchantIcon def={def} size={28} />
        <div>
          <div className="ench-name">
            {def.name} <span style={{ color: '#ffd23f' }}>{roman(def.maxLevel)}</span>
          </div>
          <div className="ench-sub">{shortEffect(def)}</div>
        </div>
      </div>
    </Tooltip>
  );
}

function shortEffect(def: EnchantDef): string {
  const e = def.effect;
  switch (e.kind) {
    case 'flatDamage': {
      const base = e.base ?? 0;
      const per = e.perLevel ?? 0;
      const formula = base ? `+${base} +${per}/lvl` : `+${per}/lvl`;
      return e.condition ? `${formula} (${e.condition})` : formula;
    }
    case 'percentReduction':
      return `${Math.round((e.perLevelPct ?? 0) * 100)}%/lvl reduction${
        e.damageType ? ` (${e.damageType})` : ''
      }`;
    case 'vanillaProtection':
      return `+${e.epfPerLevel}/lvl EPF${e.damageType ? ` (${e.damageType})` : ''}`;
    default:
      return e.condition ?? 'special';
  }
}
