import type {
  AppliedEnchant,
  BaubleState,
  BuildState,
  DamageType,
  EquipSlot,
} from '../types';
import { ARMOR_SLOTS, BAUBLE_SLOTS } from '../types';

export interface ScenarioOptions {
  incomingDamage: number;
  damageType: DamageType;
  resistanceLevel: number;
}

export interface SharedState {
  build: BuildState;
  baubles: BaubleState;
  scenario: ScenarioOptions;
}

const ALL_SLOTS: EquipSlot[] = ['mainhand', 'offhand', ...ARMOR_SLOTS];

// Compact wire form: { v, s: { slot: { i: itemId, e: [[enchId, lvl]] } }, o: {...} }
interface WireSlot {
  i: string | null;
  e: [string, number][];
}

function encodeUriSafe(json: string): string {
  // base64, then make URL-safe.
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeUriSafe(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

export function serialize(state: SharedState): string {
  const s: Record<string, WireSlot> = {};
  for (const slot of ALL_SLOTS) {
    const st = state.build[slot];
    if (!st.itemId && st.enchants.length === 0) continue;
    s[slot] = {
      i: st.itemId,
      e: st.enchants.map((a) => [a.enchantId, a.level] as [string, number]),
    };
  }
  // Baubles: { slot: baubleId } for occupied slots only.
  const b: Record<string, string> = {};
  for (const slot of BAUBLE_SLOTS) {
    const id = state.baubles[slot];
    if (id) b[slot] = id;
  }
  const payload = {
    v: 1,
    s,
    ...(Object.keys(b).length ? { b } : {}),
    o: {
      d: state.scenario.incomingDamage,
      t: state.scenario.damageType,
      r: state.scenario.resistanceLevel,
    },
  };
  return encodeUriSafe(JSON.stringify(payload));
}

export function deserialize(raw: string): SharedState | null {
  try {
    const payload = JSON.parse(decodeUriSafe(raw));
    if (!payload || payload.v !== 1) return null;

    const build = emptyBuild();
    const s = payload.s ?? {};
    for (const slot of ALL_SLOTS) {
      const wire: WireSlot | undefined = s[slot];
      if (!wire) continue;
      build[slot] = {
        itemId: wire.i ?? null,
        enchants: (wire.e ?? []).map(
          ([enchantId, level]: [string, number]): AppliedEnchant => ({
            enchantId,
            level,
          }),
        ),
      };
    }

    const baubles = emptyBaubles();
    const bWire = payload.b ?? {};
    for (const slot of BAUBLE_SLOTS) {
      const id = bWire[slot];
      if (typeof id === 'string') baubles[slot] = id;
    }

    const o = payload.o ?? {};
    const scenario: ScenarioOptions = {
      incomingDamage: typeof o.d === 'number' ? o.d : 10,
      damageType: (o.t as DamageType) ?? 'physical',
      resistanceLevel: typeof o.r === 'number' ? o.r : 0,
    };

    return { build, baubles, scenario };
  } catch {
    return null;
  }
}

export function emptyBuild(): BuildState {
  const slot = () => ({ itemId: null, enchants: [] as AppliedEnchant[] });
  return {
    mainhand: slot(),
    offhand: slot(),
    helmet: slot(),
    chestplate: slot(),
    leggings: slot(),
    boots: slot(),
  };
}

export function emptyBaubles(): BaubleState {
  return {
    amulet: null,
    ring1: null,
    ring2: null,
    belt: null,
    head: null,
    body: null,
    charm: null,
  };
}
