import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import './ui.css';
import type { EquipSlot } from './types';
import { getEnchant, getItem } from './data/catalog';
import { useBuildStore } from './store/buildStore';
import { ItemPalette } from './components/ItemPalette';
import { EnchantPalette } from './components/EnchantPalette';
import { BuildBoard } from './components/BuildBoard';
import { StatsPanel } from './components/StatsPanel';
import { ItemIcon, EnchantIcon } from './components/icons';

interface ActiveDrag {
  type: 'item' | 'enchant';
  id: string;
}

export default function App() {
  const setItem = useBuildStore((s) => s.setItem);
  const addEnchant = useBuildStore((s) => s.addEnchant);
  const reset = useBuildStore((s) => s.reset);
  const loadFromHash = useBuildStore((s) => s.loadFromHash);
  const notice = useBuildStore((s) => s.notice);
  const clearNotice = useBuildStore((s) => s.clearNotice);

  const [active, setActive] = useState<ActiveDrag | null>(null);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    loadFromHash();
  }, [loadFromHash]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 3200);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as ActiveDrag | undefined;
    if (data) setActive(data);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const over = e.over;
    const data = e.active.data.current as
      | { type: 'item' | 'enchant'; id: string }
      | undefined;
    if (!over || !data) return;
    const slot = (over.data.current as { slot?: EquipSlot } | undefined)?.slot;
    if (!slot) return;

    if (data.type === 'item') {
      setItem(slot, data.id);
    } else {
      addEnchant(slot, data.id);
    }
  }

  function share() {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {
        useBuildStore.setState({ notice: 'Copy this URL to share your build.' });
      },
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="app">
        <header className="app-header">
          <h1>RLCraft Enchant Calculator</h1>
          <div className="subtitle">
            Drag items + enchants to build a loadout. See weapon damage and armor
            damage reduction. (RLCraft &amp; Dregora)
          </div>
          <div className="header-actions">
            <button className="mc-btn" onClick={share}>
              {copied ? 'Link copied!' : 'Share build'}
            </button>
            <button className="mc-btn" onClick={reset}>
              Reset
            </button>
          </div>
        </header>

        <div className="workspace">
          <div className="col-left">
            <ItemPalette />
            <EnchantPalette />
          </div>
          <div className="col-center">
            <BuildBoard />
          </div>
          <div className="col-right">
            <StatsPanel />
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? <DragGhost active={active} /> : null}
      </DragOverlay>

      {notice && <div className="notice">{notice}</div>}
    </DndContext>
  );
}

function DragGhost({ active }: { active: ActiveDrag }) {
  if (active.type === 'item') {
    const item = getItem(active.id);
    if (!item) return null;
    return (
      <div className="inv-slot draggable drag-overlay">
        <ItemIcon icon={item.icon} id={item.id} size={40} />
      </div>
    );
  }
  const def = getEnchant(active.id);
  if (!def) return null;
  return (
    <div className="ench-row drag-overlay" style={{ cursor: 'grabbing' }}>
      <EnchantIcon def={def} size={28} />
      <span className="ench-name">{def.name}</span>
    </div>
  );
}
