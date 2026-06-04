import type { DamageType } from '../types';
import { getItem } from '../data/catalog';
import { computeArmor, computeWeapon } from '../engine';
import { useBuildStore } from '../store/buildStore';
import { roman } from './BuildBoard';

const DAMAGE_TYPES: DamageType[] = [
  'physical',
  'projectile',
  'magic',
  'blast',
  'fire',
];

export function StatsPanel() {
  return (
    <div>
      <WeaponStats />
      <ArmorStats />
    </div>
  );
}

function WeaponStats() {
  const itemId = useBuildStore((s) => s.build.mainhand.itemId);
  const enchants = useBuildStore((s) => s.build.mainhand.enchants);
  const item = getItem(itemId);

  return (
    <div className="panel mc-bevel">
      <div className="panel-title">
        <span>Weapon Output</span>
      </div>
      {!item ? (
        <div className="hint">Equip a weapon to see its damage.</div>
      ) : item.category !== 'weapon' ? (
        <div className="hint">That item isn't a weapon.</div>
      ) : (
        <WeaponResultView itemId={item.id} enchants={enchants} />
      )}
    </div>
  );
}

function WeaponResultView({
  itemId,
  enchants,
}: {
  itemId: string;
  enchants: { enchantId: string; level: number }[];
}) {
  const item = getItem(itemId)!;
  const r = computeWeapon(item, enchants);

  return (
    <div className="stat-block">
      <div className="stat-headline">{item.name}</div>
      <div className="stat-big">
        {r.min} - {r.max} dmg
      </div>
      <div className="stat-row">
        <span className="k">Per hit (no crit)</span>
        <span className="v">{r.min}</span>
      </div>
      <div className="stat-row">
        <span className="k">Per hit (crit{r.unarmoredMultiplier > 1 ? ' + unarmored' : ''})</span>
        <span className="v">{r.max}</span>
      </div>
      <div className="stat-row">
        <span className="k">DPS range</span>
        <span className="v">
          {r.dpsMin} - {r.dpsMax}
        </span>
      </div>
      <div className="stat-row">
        <span className="k">Base / speed</span>
        <span className="v">
          {r.baseDamage} / {r.attackSpeed}/s
        </span>
      </div>
      {r.flatBonus > 0 && (
        <div className="stat-row">
          <span className="k">Enchant bonus</span>
          <span className="v">+{round2(r.flatBonus)}</span>
        </div>
      )}
      {r.conditionalBonus > 0 && (
        <div className="stat-row">
          <span className="k">Situational bonus</span>
          <span className="v">+{round2(r.conditionalBonus)}</span>
        </div>
      )}

      {r.contributions.length > 0 && (
        <div className="stat-note">
          {r.contributions.map((c) => (
            <div key={c.enchantId}>
              {c.name} {roman(c.level)}: +{round2(c.flat)}
              {c.conditional ? ` (${c.condition})` : ''}
            </div>
          ))}
        </div>
      )}

      <div className="stat-note">
        Min = no crit, no situational bonus. Max = critical hit (x1.5)
        {r.unarmoredMultiplier > 1 ? ' x unarmored bonus' : ''} plus best
        situational enchant. Sharpness-type flat damage is added after the crit
        multiplier (Minecraft 1.12 order).
      </div>
    </div>
  );
}

function ArmorStats() {
  const build = useBuildStore((s) => s.build);
  const scenario = useBuildStore((s) => s.scenario);
  const setScenario = useBuildStore((s) => s.setScenario);

  const r = computeArmor(build, scenario);
  const hasArmor = r.regions.some((p) => p.itemName);

  return (
    <div className="panel mc-bevel">
      <div className="panel-title">
        <span>Damage Reduction</span>
      </div>

      <div className="control-row">
        <label>Incoming hit</label>
        <input
          type="number"
          min={1}
          max={200}
          value={scenario.incomingDamage}
          onChange={(e) =>
            setScenario({ incomingDamage: Number(e.target.value) || 0 })
          }
        />
      </div>

      <div className="control-row" style={{ flexWrap: 'wrap' }}>
        <label>Damage type</label>
        <div className="seg">
          {DAMAGE_TYPES.map((t) => (
            <button
              key={t}
              className={`mc-btn${scenario.damageType === t ? ' is-active' : ''}`}
              onClick={() => setScenario({ damageType: t })}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="control-row" style={{ flexWrap: 'wrap' }}>
        <label>Resistance</label>
        <div className="seg">
          {[0, 1, 2, 3, 4, 5].map((lvl) => (
            <button
              key={lvl}
              className={`mc-btn${scenario.resistanceLevel === lvl ? ' is-active' : ''}`}
              onClick={() => setScenario({ resistanceLevel: lvl })}
            >
              {lvl === 0 ? 'none' : roman(lvl)}
            </button>
          ))}
        </div>
      </div>

      {!hasArmor && scenario.resistanceLevel === 0 ? (
        <div className="hint">Equip armor pieces to see damage reduction.</div>
      ) : (
        <div className="stat-block">
          <div className="stat-big">
            {Math.round(r.totalReductionPct * 100)}% reduced
            <span className="stat-sub"> (hit-weighted)</span>
          </div>
          <div className="stat-row">
            <span className="k">Avg damage taken</span>
            <span className="v">
              {round2(scenario.incomingDamage * (1 - r.totalReductionPct))} of{' '}
              {scenario.incomingDamage}
            </span>
          </div>
          <div className="stat-row">
            <span className="k">Effective HP (20 base)</span>
            <span className="v">
              {r.effectiveHP === Infinity ? '∞' : r.effectiveHP}
            </span>
          </div>

          <LayerBars layers={r.layers} />

          <table className="region-table">
            <thead>
              <tr>
                <th>Body part</th>
                <th>Loc. armor</th>
                <th>Reduced</th>
                <th>Taken</th>
              </tr>
            </thead>
            <tbody>
              {r.regions.map((p) => (
                <tr key={p.key} className={p.critical ? 'is-critical' : ''}>
                  <td>
                    {p.label}
                    {p.critical ? ' *' : ''}
                    {p.itemName ? (
                      <div className="region-item">
                        {p.itemName}
                        {p.protectionName
                          ? ` + ${p.protectionName} ${roman(p.protectionLevel)}`
                          : ''}
                      </div>
                    ) : (
                      <div className="region-item region-empty">no armor</div>
                    )}
                  </td>
                  <td>{p.itemName ? p.locationalArmor : '-'}</td>
                  <td>{Math.round(p.reductionPct * 100)}%</td>
                  <td>{p.damageTaken}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="stat-note">
            * Head and Body are critical: losing either is fatal. First Aid
            (RLCraft) makes damage locational - each piece protects one body
            region, and its vanilla armor points are scaled into "locational
            armor" (head x4+3, chest x2+3, legs x2+4, feet x3+3). Per region,
            reductions layer multiplicatively (Resistance, protection enchants,
            then locational armor + toughness), each capped at 80%. The overall
            figure is weighted by how often each region is hit (the chestplate
            covers the body and both arms). Estimates for tuning builds, not
            exact in-game numbers.
          </div>
        </div>
      )}
    </div>
  );
}

function LayerBars({
  layers,
}: {
  layers: { resistance: number; protection: number; armor: number };
}) {
  const rows: [string, number, string][] = [
    ['Resistance', layers.resistance, '#b06bff'],
    ['Protection', layers.protection, '#55ffff'],
    ['Armor + toughness', layers.armor, '#5ce15c'],
  ];
  return (
    <div style={{ marginTop: 8 }}>
      {rows.map(([label, val, color]) => (
        <div key={label}>
          <div className="stat-row" style={{ borderBottom: 'none' }}>
            <span className="k">{label}</span>
            <span className="v">{Math.round(val * 100)}%</span>
          </div>
          <div className="layer-bar">
            <span style={{ width: `${val * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
