import { create } from 'zustand';
import type { BuildState, EquipSlot, Pack } from '../types';
import {
  enchantAppliesToItem,
  getEnchant,
  getItem,
} from '../data/catalog';
import { checkCompatibility } from '../engine';
import {
  deserialize,
  emptyBuild,
  serialize,
  type ScenarioOptions,
} from './urlState';

export type PackFilter = Pack | 'all';

interface BuildStore {
  build: BuildState;
  scenario: ScenarioOptions;
  packFilter: PackFilter;
  notice: string | null;

  setItem: (slot: EquipSlot, itemId: string) => void;
  clearSlot: (slot: EquipSlot) => void;
  addEnchant: (slot: EquipSlot, enchantId: string) => void;
  setEnchantLevel: (slot: EquipSlot, enchantId: string, level: number) => void;
  removeEnchant: (slot: EquipSlot, enchantId: string) => void;
  setScenario: (partial: Partial<ScenarioOptions>) => void;
  setPackFilter: (p: PackFilter) => void;
  reset: () => void;
  clearNotice: () => void;
  loadFromHash: () => void;
}

const DEFAULT_SCENARIO: ScenarioOptions = {
  incomingDamage: 10,
  damageType: 'physical',
  resistanceLevel: 0,
};

function cloneBuild(build: BuildState): BuildState {
  const out = emptyBuild();
  (Object.keys(build) as EquipSlot[]).forEach((slot) => {
    out[slot] = {
      itemId: build[slot].itemId,
      enchants: build[slot].enchants.map((e) => ({ ...e })),
    };
  });
  return out;
}

function syncHash(build: BuildState, scenario: ScenarioOptions): void {
  if (typeof window === 'undefined') return;
  const hash = serialize({ build, scenario });
  history.replaceState(null, '', `#${hash}`);
}

export const useBuildStore = create<BuildStore>((set, get) => ({
  build: emptyBuild(),
  scenario: DEFAULT_SCENARIO,
  packFilter: 'rlcraft',
  notice: null,

  setItem: (slot, itemId) => {
    const item = getItem(itemId);
    if (!item) return;
    if (item.slot !== slot) {
      set({ notice: `${item.name} can't go in the ${slot} slot.` });
      return;
    }
    const build = cloneBuild(get().build);
    // Keep only enchants that still apply to the new item.
    const keptEnchants = build[slot].enchants.filter((a) => {
      const def = getEnchant(a.enchantId);
      return def ? enchantAppliesToItem(def, item) : false;
    });
    build[slot] = { itemId, enchants: keptEnchants };
    set({ build, notice: null });
    syncHash(build, get().scenario);
  },

  clearSlot: (slot) => {
    const build = cloneBuild(get().build);
    build[slot] = { itemId: null, enchants: [] };
    set({ build });
    syncHash(build, get().scenario);
  },

  addEnchant: (slot, enchantId) => {
    const def = getEnchant(enchantId);
    if (!def) return;
    const build = cloneBuild(get().build);
    const state = build[slot];
    const item = getItem(state.itemId);

    if (!item) {
      set({ notice: 'Place an item in the slot first.' });
      return;
    }
    if (!enchantAppliesToItem(def, item)) {
      set({ notice: `${def.name} can't be applied to ${item.name}.` });
      return;
    }
    const compat = checkCompatibility(state.enchants, def);
    if (!compat.ok) {
      set({ notice: compat.reason ?? 'Incompatible enchant.' });
      return;
    }
    state.enchants = [...state.enchants, { enchantId, level: def.maxLevel }];
    set({ build, notice: null });
    syncHash(build, get().scenario);
  },

  setEnchantLevel: (slot, enchantId, level) => {
    const def = getEnchant(enchantId);
    if (!def) return;
    const clamped = Math.max(1, Math.min(def.maxLevel, Math.round(level)));
    const build = cloneBuild(get().build);
    build[slot].enchants = build[slot].enchants.map((a) =>
      a.enchantId === enchantId ? { ...a, level: clamped } : a,
    );
    set({ build });
    syncHash(build, get().scenario);
  },

  removeEnchant: (slot, enchantId) => {
    const build = cloneBuild(get().build);
    build[slot].enchants = build[slot].enchants.filter(
      (a) => a.enchantId !== enchantId,
    );
    set({ build });
    syncHash(build, get().scenario);
  },

  setScenario: (partial) => {
    const scenario = { ...get().scenario, ...partial };
    set({ scenario });
    syncHash(get().build, scenario);
  },

  setPackFilter: (p) => set({ packFilter: p }),

  reset: () => {
    const build = emptyBuild();
    set({ build, scenario: DEFAULT_SCENARIO, notice: null });
    syncHash(build, DEFAULT_SCENARIO);
  },

  clearNotice: () => set({ notice: null }),

  loadFromHash: () => {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    const parsed = deserialize(raw);
    if (parsed) {
      set({ build: parsed.build, scenario: parsed.scenario });
    }
  },
}));
