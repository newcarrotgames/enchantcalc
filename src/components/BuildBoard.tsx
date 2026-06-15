import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { BaubleSlot, EquipSlot } from '../types';
import { ARMOR_SLOTS } from '../types';
import { getBauble, getEnchant, getItem } from '../data/catalog';
import { useBuildStore } from '../store/buildStore';
import { ItemIcon } from './icons';
import { Tooltip } from './MCTooltip';
import { CharacterModel } from './CharacterModel';

const SLOT_GHOST: Record<EquipSlot, string> = {
  mainhand: 'WEAPON',
  offhand: 'OFFHAND',
  helmet: 'HEAD',
  chestplate: 'BODY',
  leggings: 'LEGS',
  boots: 'FEET',
};

const SLOT_LABEL: Record<EquipSlot, string> = {
  mainhand: 'Main hand',
  offhand: 'Off hand',
  helmet: 'Helmet',
  chestplate: 'Chestplate',
  leggings: 'Leggings',
  boots: 'Boots',
};

// Right-hand grid, row-major, matching the in-game Baubles layout:
//   Amulet | Head        ('eq' cells are equip slots, not baubles)
//   Ring   | Body
//   Ring   | Charm
//   Belt   | Off hand
type GridCell =
  | { kind: 'bauble'; slot: BaubleSlot }
  | { kind: 'equip'; slot: EquipSlot };

const RIGHT_GRID: GridCell[] = [
  { kind: 'bauble', slot: 'amulet' },
  { kind: 'bauble', slot: 'head' },
  { kind: 'bauble', slot: 'ring1' },
  { kind: 'bauble', slot: 'body' },
  { kind: 'bauble', slot: 'ring2' },
  { kind: 'bauble', slot: 'charm' },
  { kind: 'bauble', slot: 'belt' },
  { kind: 'equip', slot: 'offhand' },
];

const BAUBLE_GHOST: Record<BaubleSlot, string> = {
  amulet: 'AMULET',
  ring1: 'RING',
  ring2: 'RING',
  belt: 'BELT',
  head: 'HEAD',
  body: 'BODY',
  charm: 'CHARM',
};

export function BuildBoard() {
  const [selected, setSelected] = useState<EquipSlot>('mainhand');

  return (
    <div className="panel mc-bevel inventory">
      <div className="panel-title">
        <span>Inventory</span>
        <span style={{ fontSize: 9, color: '#7c7c7c' }}>click a slot to edit enchants</span>
      </div>

      <div className="inv-layout">
        <div className="inv-col inv-armor-col">
          {ARMOR_SLOTS.map((slot) => (
            <EquipSlotView
              key={slot}
              slot={slot}
              selected={selected === slot}
              onSelect={setSelected}
            />
          ))}
          <EquipSlotView
            slot="mainhand"
            selected={selected === 'mainhand'}
            onSelect={setSelected}
          />
        </div>

        <CharacterModel />

        <div className="inv-bauble-grid">
          {RIGHT_GRID.map((cell) =>
            cell.kind === 'bauble' ? (
              <BaubleSlotView key={cell.slot} slot={cell.slot} />
            ) : (
              <EquipSlotView
                key={cell.slot}
                slot={cell.slot}
                selected={selected === cell.slot}
                onSelect={setSelected}
                showLabel={false}
              />
            ),
          )}
        </div>
      </div>

      <EnchantEditor slot={selected} />
    </div>
  );
}

function EquipSlotView({
  slot,
  selected,
  onSelect,
  showLabel = true,
  className = '',
}: {
  slot: EquipSlot;
  selected: boolean;
  onSelect: (slot: EquipSlot) => void;
  showLabel?: boolean;
  className?: string;
}) {
  const state = useBuildStore((s) => s.build[slot]);
  const clearSlot = useBuildStore((s) => s.clearSlot);
  const { isOver, setNodeRef } = useDroppable({
    id: `slot:${slot}`,
    data: { slot },
  });

  const item = getItem(state.itemId);

  const box = (
    <div
      ref={setNodeRef}
      className={`equip-slot mc-inset${className ? ` ${className}` : ''}${
        isOver ? ' is-over' : ''
      }${selected ? ' is-selected' : ''}`}
      title={item ? item.name : SLOT_LABEL[slot]}
      onClick={() => onSelect(slot)}
    >
      {item ? (
        <>
          <Tooltip content={<ItemTooltip itemId={item.id} />}>
            <ItemIcon icon={item.icon} id={item.id} size={40} />
          </Tooltip>
          <button
            className="mc-btn x-btn equip-x"
            title="Remove item"
            onClick={(e) => {
              e.stopPropagation();
              clearSlot(slot);
            }}
          >
            x
          </button>
          {state.enchants.length > 0 && (
            <span className="equip-ench-badge">{state.enchants.length}</span>
          )}
        </>
      ) : (
        <span className="slot-ghost">{SLOT_GHOST[slot]}</span>
      )}
    </div>
  );

  if (!showLabel) return box;

  return (
    <div className="equip-slot-wrap">
      {box}
      <span className="equip-slot-label">{SLOT_LABEL[slot]}</span>
    </div>
  );
}

function EnchantEditor({ slot }: { slot: EquipSlot }) {
  const state = useBuildStore((s) => s.build[slot]);
  const item = getItem(state.itemId);

  return (
    <div className="inv-editor mc-inset">
      <div className="inv-editor-head">
        <span className="inv-editor-slot">{SLOT_LABEL[slot]}</span>
        {item ? (
          <span className="slot-item-name">{item.name}</span>
        ) : (
          <span className="slot-item-empty">empty</span>
        )}
      </div>

      {item ? (
        <>
          <div className="slot-meta">
            {item.category === 'weapon'
              ? `${item.baseDamage} dmg | ${item.attackSpeed}/s`
              : `${item.armorPoints} armor | ${item.toughness} tough`}
          </div>
          <EnchantChips slot={slot} />
          {state.enchants.length === 0 && (
            <div className="hint">Drag an enchant onto this item, or pick one from the catalog.</div>
          )}
        </>
      ) : (
        <div className="hint">
          Drag an item from the catalog onto the {SLOT_LABEL[slot].toLowerCase()} slot.
        </div>
      )}
    </div>
  );
}

function BaubleSlotView({ slot }: { slot: BaubleSlot }) {
  const baubleId = useBuildStore((s) => s.baubles[slot]);
  const clearBauble = useBuildStore((s) => s.clearBauble);
  const { isOver, setNodeRef } = useDroppable({
    id: `bauble:${slot}`,
    data: { baubleSlot: slot },
  });

  const bauble = getBauble(baubleId);

  return (
    <div
      ref={setNodeRef}
      className={`bauble-slot mc-inset${isOver ? ' is-over' : ''}`}
      title={bauble ? bauble.name : BAUBLE_GHOST[slot]}
    >
      {bauble ? (
        <>
          <Tooltip content={<BaubleTooltip baubleId={bauble.id} />}>
            <ItemIcon icon={bauble.icon} id={bauble.id} size={36} />
          </Tooltip>
          <button
            className="mc-btn x-btn bauble-x"
            title="Remove bauble"
            onClick={() => clearBauble(slot)}
          >
            x
          </button>
        </>
      ) : (
        <span className="slot-ghost bauble-ghost">{BAUBLE_GHOST[slot]}</span>
      )}
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

export function BaubleTooltip({ baubleId }: { baubleId: string }) {
  const def = getBauble(baubleId);
  if (!def) return null;
  return (
    <div>
      <div className="tt-title">{def.name}</div>
      {def.mod && <div className="tt-purple">{def.mod}</div>}
      <div className="tt-gray">Bauble ({def.baubleType})</div>
      {def.effects.length > 0 ? (
        def.effects.map((eff, i) => (
          <div key={i} className="tt-yellow">
            {baubleEffectLabel(eff)}
          </div>
        ))
      ) : (
        <div className="tt-gray">No calculated combat effect.</div>
      )}
      {def.description && (
        <div className="tt-gray" style={{ marginTop: 4 }}>
          {def.description}
        </div>
      )}
    </div>
  );
}

function baubleEffectLabel(eff: import('../types').EnchantEffect): string {
  const v = eff.base ?? 0;
  switch (eff.kind) {
    case 'flatDamage':
      return eff.condition
        ? `+${v} Attack Damage (${eff.condition})`
        : `+${v} Attack Damage`;
    case 'damageMultiplier':
      return `+${Math.round(v * 100)}% Damage`;
    case 'attackSpeedMultiplier':
      return `+${Math.round(v * 100)}% Attack Speed`;
    case 'resistance':
      return `Resistance +${v}`;
    case 'maxHp':
      return `+${v} Max HP`;
    case 'locationalArmor':
      return `+${v} Locational Armor`;
    case 'percentReduction':
      return `${Math.round((eff.perLevelPct ?? 0) * 100)}% ${eff.damageType ?? ''} reduction`.trim();
    case 'vanillaProtection':
      return `+${eff.epfPerLevel ?? 0} EPF ${eff.damageType ?? ''}`.trim();
    default:
      return '';
  }
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
