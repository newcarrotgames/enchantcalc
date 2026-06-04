import { useDroppable } from '@dnd-kit/core';
import type { EquipSlot } from '../types';
import { getEnchant, getItem } from '../data/catalog';
import { useBuildStore } from '../store/buildStore';
import { ItemIcon } from './icons';
import { Tooltip } from './MCTooltip';

const SLOT_ORDER: EquipSlot[] = [
  'mainhand',
  'helmet',
  'chestplate',
  'leggings',
  'boots',
];

const SLOT_GHOST: Record<EquipSlot, string> = {
  mainhand: 'WEAPON',
  helmet: 'HEAD',
  chestplate: 'BODY',
  leggings: 'LEGS',
  boots: 'FEET',
};

export function BuildBoard() {
  return (
    <div className="panel mc-bevel">
      <div className="panel-title">
        <span>Build</span>
        <span style={{ fontSize: 9, color: '#555' }}>drag items + enchants here</span>
      </div>
      <div className="board">
        {SLOT_ORDER.map((slot) => (
          <BoardSlot key={slot} slot={slot} />
        ))}
      </div>
    </div>
  );
}

function BoardSlot({ slot }: { slot: EquipSlot }) {
  const state = useBuildStore((s) => s.build[slot]);
  const clearSlot = useBuildStore((s) => s.clearSlot);
  const { isOver, setNodeRef } = useDroppable({
    id: `slot:${slot}`,
    data: { slot },
  });

  const item = getItem(state.itemId);

  return (
    <div
      ref={setNodeRef}
      className={`board-slot mc-inset${isOver ? ' is-over' : ''}`}
    >
      <div className="big-slot">
        {item ? (
          <Tooltip content={<ItemTooltip itemId={item.id} />}>
            <ItemIcon icon={item.icon} id={item.id} size={48} />
          </Tooltip>
        ) : (
          <span className="slot-ghost">{SLOT_GHOST[slot]}</span>
        )}
      </div>

      <div className="slot-body">
        <div className="slot-head">
          {item ? (
            <span className="slot-item-name">{item.name}</span>
          ) : (
            <span className="slot-item-empty">Empty {slot}</span>
          )}
          {item && (
            <button className="mc-btn x-btn" title="Remove item" onClick={() => clearSlot(slot)}>
              x
            </button>
          )}
        </div>

        {item && (
          <div className="slot-meta">
            {item.category === 'weapon'
              ? `${item.baseDamage} dmg | ${item.attackSpeed}/s`
              : `${item.armorPoints} armor | ${item.toughness} tough`}
          </div>
        )}

        {item && <EnchantChips slot={slot} />}

        {item && state.enchants.length === 0 && (
          <div className="hint">Drag an enchant onto this item.</div>
        )}
      </div>
    </div>
  );
}

function EnchantChips({ slot }: { slot: EquipSlot }) {
  const enchants = useBuildStore((s) => s.build[slot].enchants);
  const setEnchantLevel = useBuildStore((s) => s.setEnchantLevel);
  const removeEnchant = useBuildStore((s) => s.removeEnchant);

  if (enchants.length === 0) return null;

  return (
    <div className="chip-list">
      {enchants.map((a) => {
        const def = getEnchant(a.enchantId);
        if (!def) return null;
        return (
          <div className="chip" key={a.enchantId}>
            <Tooltip content={<EnchantTooltip enchantId={def.id} />}>
              <span className="chip-name">{def.name}</span>
            </Tooltip>
            <button
              className="mc-btn lvl-btn"
              onClick={() => setEnchantLevel(slot, a.enchantId, a.level - 1)}
              disabled={a.level <= 1}
            >
              -
            </button>
            <span className="lvl-val">{roman(a.level)}</span>
            <button
              className="mc-btn lvl-btn"
              onClick={() => setEnchantLevel(slot, a.enchantId, a.level + 1)}
              disabled={a.level >= def.maxLevel}
            >
              +
            </button>
            <button
              className="mc-btn x-btn"
              title="Remove enchant"
              onClick={() => removeEnchant(slot, a.enchantId)}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ItemTooltip({ itemId }: { itemId: string }) {
  const item = getItem(itemId);
  if (!item) return null;
  return (
    <div>
      <div className="tt-title">{item.name}</div>
      {item.mod && <div className="tt-purple">{item.mod}</div>}
      <div className="tt-gray">{packLabel(item.pack)}</div>
      {item.category === 'weapon' ? (
        <>
          <div className="tt-yellow">{item.baseDamage} Attack Damage</div>
          <div className="tt-yellow">{item.attackSpeed} Attack Speed</div>
          {item.unarmoredNote && <div className="tt-gray">{item.unarmoredNote}</div>}
        </>
      ) : (
        <>
          <div className="tt-yellow">{item.armorPoints} Armor</div>
          <div className="tt-yellow">{item.toughness} Toughness</div>
        </>
      )}
      {item.note && <div className="tt-gray">{item.note}</div>}
    </div>
  );
}

export function EnchantTooltip({ enchantId }: { enchantId: string }) {
  const def = getEnchant(enchantId);
  if (!def) return null;
  return (
    <div>
      <div className="tt-purple">
        {def.name} (max {roman(def.maxLevel)})
      </div>
      <div className="tt-gray">
        {def.mod ? `${def.mod} | ` : ''}
        {packLabel(def.pack)} | {rarityLabel(def.rarity)}
      </div>
      <div className="tt-title" style={{ marginTop: 4 }}>
        {def.description}
      </div>
    </div>
  );
}

export function roman(n: number): string {
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let v = n;
  for (const [val, sym] of map) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out || String(n);
}

export function packLabel(pack: string): string {
  if (pack === 'rlcraft') return 'RLCraft';
  if (pack === 'dregora') return 'Dregora';
  return 'Vanilla';
}

function rarityLabel(r: string): string {
  switch (r) {
    case 'veryRare':
      return 'Very Rare';
    case 'na':
      return '-';
    default:
      return r.charAt(0).toUpperCase() + r.slice(1);
  }
}
