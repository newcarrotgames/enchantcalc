import type { ReactNode } from 'react';
import type { DamageType } from '../types';
import { getItem } from '../data/catalog';
import { aggregateBaubleBonuses, computeArmor, computeWeapon } from '../engine';
import type { BaubleContribution } from '../engine';
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

// A potion-effect-styled "buff" card: a coloured glyph box, a title, a big
// value, and an optional sub line. Mirrors the vanilla active-effects list.
function BuffCard({
  glyph,
  accent,
  title,
  value,
  sub,
}: {
  glyph: string;
  accent: string;
  title: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="buff-card mc-inset">
      <div className="buff-icon" style={{ color: accent, borderColor: accent }}>
        {glyph}
      </div>
      <div className="buff-body">
        <div className="buff-title">{title}</div>
        <div className="buff-value" style={{ color: accent }}>
          {value}
        </div>
        {sub != null && <div className="buff-sub">{sub}</div>}
      </div>
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
  const baubles = useBuildStore((s) => s.baubles);
  const item = getItem(itemId)!;
  const { bonuses, contributions } = aggregateBaubleBonuses(baubles);
  const r = computeWeapon(item, enchants, bonuses);
  const baubleParts = contributions.filter((c) =>
    c.parts.some((p) => /dmg|damage|attack speed/i.test(p)),
  );

  return (
    <div className="stat-block">
      <div className="stat-headline">{item.name}</div>

      <div className="buff-list">
        <BuffCard
          glyph="DMG"
          accent="var(--mc-green)"
          title="Damage per hit"
          value={`${r.min} - ${r.max}`}
          sub={`base ${r.baseDamage}${r.flatBonus > 0 ? ` + ${round2(r.flatBonus)} enchant` : ''}`}
        />
        <BuffCard
          glyph="DPS"
          accent="var(--mc-aqua)"
          title="DPS range"
          value={`${r.dpsMin} - ${r.dpsMax}`}
          sub={`${r.effectiveAttackSpeed}/s effective speed`}
        />
        {r.dots.length > 0 && (
          <BuffCard
            glyph="DoT"
            accent="var(--mc-purple)"
            title="Damage over time"
            value={
              r.dotExpected === r.dotMax
                ? `+${round2(r.dotMax)}`
                : `~${round2(r.dotExpected)}`
            }
            sub={`up to +${round2(r.dotMax)} (separate from per-hit)`}
          />
        )}
      </div>

      <div className="stat-row">
        <span className="k">Per hit (no crit)</span>
        <span className="v">{r.min}</span>
      </div>
      <div className="stat-row">
        <span className="k">Per hit (crit{r.unarmoredMultiplier > 1 ? ' + situational' : ''})</span>
        <span className="v">{r.max}</span>
      </div>
      <div className="stat-row">
        <span className="k">Base / speed</span>
        <span className="v">
          {r.baseDamage} / {r.attackSpeed}/s
        </span>
      </div>
      {r.attackSpeedMultiplier !== 1 && (
        <div className="stat-row">
          <span className="k">Effective speed</span>
          <span className="v">
            {r.effectiveAttackSpeed}/s (x{round2(r.attackSpeedMultiplier)})
          </span>
        </div>
      )}
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

      {r.dots.length > 0 && (
        <div className="stat-note">
          {r.dots.map((d) => (
            <div key={d.enchantId}>
              {d.name} {roman(d.level)}: {d.type} {dotAmountLabel(d)} over {d.seconds}s
              {d.chance < 1 ? ` (${Math.round(d.chance * 100)}% chance)` : ''}
              {!d.canKill ? ' [can\u2019t kill]' : ''}
              {d.note ? ` - ${d.note}` : ''}
            </div>
          ))}
          <div style={{ marginTop: 4 }}>
            DoT is estimated and listed separately: it ticks over time, does not
            crit or scale with attack speed, and many targets resist it. Not
            added to the per-hit range above.
          </div>
        </div>
      )}

      {(r.contributions.length > 0 || r.speedContributions.length > 0) && (
        <div className="stat-note">
          {r.contributions.map((c) => (
            <div key={c.enchantId}>
              {c.name} {roman(c.level)}: {c.flat >= 0 ? '+' : ''}
              {round2(c.flat)}
              {c.conditional ? ` (${c.condition})` : ''}
            </div>
          ))}
          {r.speedContributions.map((c) => (
            <div key={c.enchantId}>
              {c.name} {roman(c.level)}: {c.deltaFraction >= 0 ? '+' : ''}
              {Math.round(c.deltaFraction * 100)}% attack speed
            </div>
          ))}
        </div>
      )}

      <BaubleContribList title="Baubles" contributions={baubleParts} />

      <div className="stat-note">
        Min = no crit, no situational bonus. Max = critical hit (x1.5)
        {r.unarmoredMultiplier > 1 ? ` x situational bonus (${r.unarmoredNote})` : ''} plus best
        situational enchant. Sharpness-type flat damage is added after the crit
        multiplier (Minecraft 1.12 order). DPS uses the effective attack speed,
        so attack-speed enchants (e.g. Swifter Slashes) scale it.
      </div>
    </div>
  );
}

function ArmorStats() {
  const build = useBuildStore((s) => s.build);
  const baubles = useBuildStore((s) => s.baubles);
  const scenario = useBuildStore((s) => s.scenario);
  const setScenario = useBuildStore((s) => s.setScenario);

  const { bonuses, contributions } = aggregateBaubleBonuses(
    baubles,
    scenario.damageType,
  );
  const r = computeArmor(build, scenario, bonuses);
  const hasArmor = r.regions.some((p) => p.itemName);
  const baubleParts = contributions.filter((c) =>
    c.parts.some((p) => /armor|resistance|max hp|reduction|epf/i.test(p)),
  );
  const hasBaubleDefense = baubleParts.length > 0;

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

      {!hasArmor && scenario.resistanceLevel === 0 && !hasBaubleDefense ? (
        <div className="hint">Equip armor pieces to see damage reduction.</div>
      ) : (
        <div className="stat-block">
          <div className="buff-list">
            <BuffCard
              glyph="DEF"
              accent="var(--mc-green)"
              title="Damage reduced"
              value={`${Math.round(r.totalReductionPct * 100)}%`}
              sub="hit-weighted across all regions"
            />
            <BuffCard
              glyph="HIT"
              accent="var(--mc-yellow)"
              title="Avg damage taken"
              value={round2(scenario.incomingDamage * (1 - r.totalReductionPct))}
              sub={`of ${scenario.incomingDamage} incoming`}
            />
            <BuffCard
              glyph="HP"
              accent="var(--mc-aqua)"
              title={`Effective HP (${20 + bonuses.maxHpFlat} base)`}
              value={r.effectiveHP === Infinity ? '\u221e' : r.effectiveHP}
            />
          </div>

          <BaubleContribList title="Baubles" contributions={baubleParts} />

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

function BaubleContribList({
  title,
  contributions,
}: {
  title: string;
  contributions: BaubleContribution[];
}) {
  if (contributions.length === 0) return null;
  return (
    <div className="stat-note">
      <div style={{ color: '#b06bff' }}>{title}</div>
      {contributions.map((c) => (
        <div key={c.id}>
          {c.name}: {c.parts.join(', ')}
        </div>
      ))}
    </div>
  );
}

function dotAmountLabel(d: {
  min: number;
  max: number;
}): string {
  return d.min === d.max ? `~${round2(d.max)}` : `${round2(d.min)}-${round2(d.max)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
