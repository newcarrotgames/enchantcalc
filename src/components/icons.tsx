import type { CSSProperties } from 'react';
import type { EnchantDef } from '../types';

// Real in-game sprites extracted from the modpack by scripts/extractIcons.mjs,
// keyed by item id. Items without a sprite fall back to the procedural SVGs
// below. See AGENTS.md for the texture sources.
const ICON_URLS = import.meta.glob('../assets/item-icons/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const PNG_BY_ID: Record<string, string> = {};
for (const [path, url] of Object.entries(ICON_URLS)) {
  const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, '');
  PNG_BY_ID[id] = url;
}

interface Material {
  light: string;
  dark: string;
}

const MATERIALS: Record<string, Material> = {
  wood: { light: '#9c6b3c', dark: '#6b4a29' },
  stone: { light: '#9a9a9a', dark: '#6e6e6e' },
  iron: { light: '#dadada', dark: '#9a9a9a' },
  gold: { light: '#fbe14a', dark: '#c9a21f' },
  diamond: { light: '#4aedd9', dark: '#2bb6a6' },
  leather: { light: '#a0673b', dark: '#6f4526' },
  chainmail: { light: '#b0b0b0', dark: '#7a7a7a' },
  copper: { light: '#e0894f', dark: '#a85a2d' },
  tin: { light: '#cdd3d6', dark: '#9aa1a5' },
  bronze: { light: '#cd8b4a', dark: '#9a6325' },
  steel: { light: '#b7c0c4', dark: '#7f888c' },
  silver: { light: '#dfe6ea', dark: '#a9b2b8' },
  invar: { light: '#c3c1ac', dark: '#8f8d78' },
  platinum: { light: '#d6e0e6', dark: '#9fb0b8' },
  electrum: { light: '#f0d98a', dark: '#c2a851' },
  nickel: { light: '#d9d3a8', dark: '#a39d72' },
  lead: { light: '#7d7f93', dark: '#54566a' },
  aluminium: { light: '#d7dbde', dark: '#a0a5a9' },
  signalum: { light: '#e08a4f', dark: '#a8522a' },
  lumium: { light: '#f4e89a', dark: '#c2b052' },
  enderium: { light: '#2f8f86', dark: '#1c5b55' },
  golem: { light: '#8f8a82', dark: '#5d5953' },
  umbrium: { light: '#7a5fa6', dark: '#4c3a6b' },
  neptunium: { light: '#46c7c0', dark: '#2a8a85' },
  bookwyrm: { light: '#6f8f5a', dark: '#47603a' },
  molten: { light: '#e06a30', dark: '#a23c12' },
  famine: { light: '#6b6f55', dark: '#454836' },
  swine: { light: '#e0a6b0', dark: '#b06e7a' },
  weta: { light: '#b6a06a', dark: '#7e6e42' },
  scarlite: { light: '#c0392b', dark: '#7d2018' },
  tide: { light: '#3f7fb0', dark: '#27517a' },
  dragonbone: { light: '#ece7d3', dark: '#b7ad8e' },
  fire_dragonbone: { light: '#ff8a3c', dark: '#b3471a' },
  ice_dragonbone: { light: '#9fe3ff', dark: '#4f9fd1' },
  lightning_dragonbone: { light: '#f4e26a', dark: '#b9a128' },
  desert_myrmex: { light: '#e3c98a', dark: '#b0975a' },
  jungle_myrmex: { light: '#9fbf6a', dark: '#6f8c3f' },
  desert_venom: { light: '#d4b15a', dark: '#a07f2e' },
  jungle_venom: { light: '#8fc24a', dark: '#5f8c24' },
  default: { light: '#bdbdbd', dark: '#7d7d7d' },
};

// Icon keys are "shape:material" (material may contain underscores).
function materialOf(icon: string): Material {
  const key = icon.split(':')[1] ?? 'default';
  return MATERIALS[key] ?? MATERIALS.default;
}

function shapeOf(icon: string): string {
  return icon.split(':')[0];
}

const svgProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 32 32',
  shapeRendering: 'crispEdges' as const,
  style: { display: 'block' } as CSSProperties,
});

export function ItemIcon({
  icon,
  id,
  size = 32,
}: {
  icon: string;
  id?: string;
  size?: number;
}) {
  const png = id ? PNG_BY_ID[id] : undefined;
  if (png) {
    return (
      <img
        src={png}
        width={size}
        height={size}
        alt=""
        draggable={false}
        style={{ display: 'block', imageRendering: 'pixelated' }}
      />
    );
  }

  const m = materialOf(icon);
  const shape = shapeOf(icon);
  const stroke = m.dark;

  switch (shape) {
    case 'sword':
      return (
        <svg {...svgProps(size)}>
          <polygon points="13,3 16,0 19,3" fill={m.light} stroke={stroke} />
          <rect x="13" y="3" width="6" height="17" fill={m.light} stroke={stroke} />
          <rect x="8" y="20" width="16" height="3" fill="#6b4a29" stroke="#4a3219" />
          <rect x="14" y="23" width="4" height="6" fill="#4a3219" />
          <rect x="13" y="29" width="6" height="3" fill="#caa64a" stroke="#9a7a22" />
        </svg>
      );
    case 'katana':
      return (
        <svg {...svgProps(size)}>
          <polygon points="14,2 18,2 18,4 14,6" fill={m.light} stroke={stroke} />
          <rect x="14" y="3" width="4" height="19" fill={m.light} stroke={stroke} />
          <circle cx="16" cy="23" r="4" fill="#caa64a" stroke="#9a7a22" />
          <rect x="14" y="24" width="4" height="7" fill="#222" />
        </svg>
      );
    case 'axe':
      return (
        <svg {...svgProps(size)}>
          <rect x="15" y="6" width="4" height="24" fill="#6b4a29" stroke="#4a3219" />
          <polygon
            points="15,5 5,9 5,17 15,19"
            fill={m.light}
            stroke={stroke}
          />
        </svg>
      );
    case 'dagger':
      return (
        <svg {...svgProps(size)}>
          <polygon points="13,8 16,5 19,8" fill={m.light} stroke={stroke} />
          <rect x="13" y="8" width="6" height="11" fill={m.light} stroke={stroke} />
          <rect x="10" y="19" width="12" height="2" fill="#6b4a29" stroke="#4a3219" />
          <rect x="14" y="21" width="4" height="6" fill="#4a3219" />
        </svg>
      );
    case 'greatsword':
      return (
        <svg {...svgProps(size)}>
          <polygon points="11,3 16,0 21,3" fill={m.light} stroke={stroke} />
          <rect x="11" y="3" width="10" height="18" fill={m.light} stroke={stroke} />
          <rect x="6" y="21" width="20" height="3" fill="#6b4a29" stroke="#4a3219" />
          <rect x="14" y="24" width="4" height="6" fill="#4a3219" />
        </svg>
      );
    case 'rapier':
      return (
        <svg {...svgProps(size)}>
          <polygon points="15,1 17,1 16,3" fill={m.light} stroke={stroke} />
          <rect x="15" y="2" width="2" height="20" fill={m.light} stroke={stroke} />
          <path d="M12 22 q4 4 8 0" fill="none" stroke="#caa64a" strokeWidth="2" />
          <rect x="15" y="24" width="2" height="6" fill="#4a3219" />
        </svg>
      );
    case 'polearm':
      return (
        <svg {...svgProps(size)}>
          <rect x="15" y="3" width="3" height="27" fill="#6b4a29" stroke="#4a3219" />
          <polygon points="16,1 21,7 16,11 13,7" fill={m.light} stroke={stroke} />
        </svg>
      );
    case 'mace':
      return (
        <svg {...svgProps(size)}>
          <rect x="15" y="12" width="3" height="18" fill="#6b4a29" stroke="#4a3219" />
          <rect x="11" y="4" width="11" height="9" fill={m.light} stroke={stroke} />
          <rect x="9" y="6" width="2" height="5" fill={m.dark} />
          <rect x="22" y="6" width="2" height="5" fill={m.dark} />
        </svg>
      );
    case 'boomerang':
      return (
        <svg {...svgProps(size)}>
          <polygon
            points="6,8 12,6 18,16 24,24 18,26 12,16"
            fill={m.light}
            stroke={stroke}
          />
        </svg>
      );
    case 'nunchaku':
      return (
        <svg {...svgProps(size)}>
          {/* two batons joined by a chain */}
          <rect x="6" y="4" width="4" height="13" fill={m.light} stroke={stroke} />
          <rect x="22" y="15" width="4" height="13" fill={m.light} stroke={stroke} />
          <rect x="9" y="15" width="3" height="2" fill="#3a3a3a" />
          <rect x="12" y="16" width="3" height="2" fill="#3a3a3a" />
          <rect x="15" y="16" width="3" height="2" fill="#3a3a3a" />
          <rect x="18" y="15" width="3" height="2" fill="#3a3a3a" />
        </svg>
      );
    case 'fist':
      return (
        <svg {...svgProps(size)}>
          <rect x="8" y="13" width="16" height="13" fill="#e0a87a" stroke="#a9764b" />
          <rect x="9" y="10" width="3" height="4" fill="#e0a87a" stroke="#a9764b" />
          <rect x="13" y="9" width="3" height="5" fill="#e0a87a" stroke="#a9764b" />
          <rect x="17" y="9" width="3" height="5" fill="#e0a87a" stroke="#a9764b" />
          <rect x="20" y="10" width="3" height="4" fill="#e0a87a" stroke="#a9764b" />
        </svg>
      );
    case 'helmet':
      return (
        <svg {...svgProps(size)}>
          <polygon
            points="6,24 6,12 9,9 23,9 26,12 26,24"
            fill={m.light}
            stroke={stroke}
          />
          <rect x="9" y="16" width="14" height="8" fill="#2a2a2a" />
          <rect x="9" y="16" width="14" height="2" fill={m.dark} />
        </svg>
      );
    case 'chestplate':
      return (
        <svg {...svgProps(size)}>
          <polygon
            points="5,9 12,9 12,12 20,12 20,9 27,9 27,15 23,19 23,28 9,28 9,19 5,15"
            fill={m.light}
            stroke={stroke}
          />
          <rect x="13" y="9" width="6" height="3" fill="#2a2a2a" />
        </svg>
      );
    case 'leggings':
      return (
        <svg {...svgProps(size)}>
          <rect x="8" y="6" width="16" height="7" fill={m.light} stroke={stroke} />
          <rect x="8" y="12" width="6" height="18" fill={m.light} stroke={stroke} />
          <rect x="18" y="12" width="6" height="18" fill={m.light} stroke={stroke} />
        </svg>
      );
    case 'boots':
      return (
        <svg {...svgProps(size)}>
          <polygon
            points="6,12 13,12 13,22 17,22 17,27 6,27"
            fill={m.light}
            stroke={stroke}
          />
          <polygon
            points="19,12 26,12 26,27 15,27 15,22 19,22"
            fill={m.light}
            stroke={stroke}
          />
        </svg>
      );
    case 'ring':
      return (
        <svg {...svgProps(size)}>
          <circle cx="16" cy="19" r="9" fill="none" stroke="#caa64a" strokeWidth="3" />
          <polygon points="16,4 19,9 13,9" fill={m.light} stroke={stroke} />
          <rect x="14" y="7" width="4" height="3" fill={m.light} stroke={stroke} />
        </svg>
      );
    case 'amulet':
      return (
        <svg {...svgProps(size)}>
          <path d="M8 6 q8 9 16 0" fill="none" stroke="#caa64a" strokeWidth="2" />
          <polygon
            points="16,14 22,20 16,28 10,20"
            fill={m.light}
            stroke={stroke}
          />
        </svg>
      );
    case 'belt':
      return (
        <svg {...svgProps(size)}>
          <rect x="4" y="13" width="24" height="6" fill="#6b4a29" stroke="#4a3219" />
          <rect x="13" y="11" width="6" height="10" fill="#caa64a" stroke="#9a7a22" />
          <rect x="15" y="14" width="2" height="4" fill="#4a3219" />
        </svg>
      );
    case 'charm':
      return (
        <svg {...svgProps(size)}>
          <circle cx="16" cy="17" r="8" fill={m.light} stroke={stroke} />
          <circle cx="16" cy="17" r="3" fill="#caa64a" stroke="#9a7a22" />
          <rect x="15" y="4" width="2" height="6" fill="#caa64a" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps(size)}>
          <rect x="6" y="6" width="20" height="20" fill={m.light} stroke={stroke} />
        </svg>
      );
  }
}

function enchantCover(def: EnchantDef): string {
  switch (def.effect.kind) {
    case 'flatDamage':
      return '#b03030';
    case 'attackSpeedMultiplier':
      return '#3aa05b';
    case 'percentReduction':
    case 'vanillaProtection':
      return '#3a5bd0';
    case 'dot':
      return '#cf6a1f';
    default:
      return '#6a6a6a';
  }
}

export function EnchantIcon({ def, size = 32 }: { def: EnchantDef; size?: number }) {
  const cover = enchantCover(def);
  return (
    <svg {...svgProps(size)}>
      <rect x="6" y="5" width="20" height="22" fill={cover} stroke="#1c1c1c" />
      <rect x="6" y="5" width="4" height="22" fill="#1c1c1c" />
      <rect x="22" y="7" width="3" height="18" fill="#efe7c8" />
      {/* enchant glint */}
      <rect x="13" y="11" width="2" height="6" fill="#d9a7ff" />
      <rect x="11" y="13" width="6" height="2" fill="#d9a7ff" />
      <rect x="19" y="17" width="2" height="4" fill="#d9a7ff" />
      <rect x="18" y="18" width="4" height="2" fill="#d9a7ff" />
    </svg>
  );
}
