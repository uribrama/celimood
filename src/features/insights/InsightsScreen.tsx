import { useMemo, useState } from 'react';
import { Screen } from '../../components/TabBar';
import { Chip } from '../../components/Chip';
import {
  MOOD_LABEL,
  averageEnergy,
  averageMoodByTag,
  energyDistribution,
  moodDistribution,
  summarizeMonth,
  totalDaysLogged,
  type MoodLevel,
} from '../../domain/mood';
import { symptomFrequency } from '../../domain/cycle';
import { useLiveQuery } from '../../db/useLiveQuery';
import { getAllMoodEntries } from '../../db/moodRepo';
import { getAllCycleDays } from '../../db/cycleRepo';
import { addDays, todayKey, type DateKey } from '../../domain/dates';
import { db } from '../../db/schema';

const MOOD_VAR: Record<MoodLevel, string> = {
  1: 'var(--mood-1)',
  2: 'var(--mood-2)',
  3: 'var(--mood-3)',
  4: 'var(--mood-4)',
  5: 'var(--mood-5)',
};

/** Ninguna de estas es "la" respuesta correcta — por eso se elige, no se
 * asume. Default 30 días: suficiente para que un tag ocasional no domine,
 * corto para que un cambio reciente todavía se note. */
const RANGE_OPTIONS: { days: number | null; label: string }[] = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
  { days: null, label: 'Todo' },
];

type InsightsScreenProps = {
  onOpenBrowse: () => void;
  onOpenCycle: () => void;
  cycleTrackingEnabled: boolean;
};

export function InsightsScreen({ onOpenBrowse, onOpenCycle, cycleTrackingEnabled }: InsightsScreenProps) {
  const allEntries = useLiveQuery(getAllMoodEntries, []) ?? [];
  const allCycleDays = useLiveQuery(getAllCycleDays, []) ?? [];
  const allTags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const allSymptoms = useLiveQuery(() => db.symptoms.toArray(), []) ?? [];
  const [rangeDays, setRangeDays] = useState<number | null>(30);

  const tagLabel = useMemo(() => {
    const byId = new Map(allTags.map((t) => [t.id, `${t.emoji} ${t.label}`]));
    return (id: string) => byId.get(id) ?? id;
  }, [allTags]);

  const symptomLabel = useMemo(() => {
    const byId = new Map(allSymptoms.map((s) => [s.id, s.label]));
    return (id: string) => byId.get(id) ?? id;
  }, [allSymptoms]);

  const cutoff: DateKey | null = rangeDays === null ? null : addDays(todayKey(), -rangeDays);

  const entries = useMemo(() => {
    if (cutoff === null) return allEntries;
    return allEntries.filter((e) => e.date >= cutoff);
  }, [allEntries, cutoff]);

  const cycleDaysInRange = useMemo(() => {
    if (cutoff === null) return allCycleDays;
    return allCycleDays.filter((d) => d.date >= cutoff);
  }, [allCycleDays, cutoff]);

  const distribution = useMemo(() => moodDistribution(entries), [entries]);
  const byTag = useMemo(() => averageMoodByTag(entries), [entries]);
  const energyDist = useMemo(() => energyDistribution(entries), [entries]);
  const avgEnergy = useMemo(() => averageEnergy(entries), [entries]);
  const symptomFreq = useMemo(() => symptomFrequency(cycleDaysInRange), [cycleDaysInRange]);
  const monthSummary = useMemo(() => summarizeMonth(allEntries, todayKey()), [allEntries]);

  const maxCount = Math.max(1, ...Object.values(distribution));
  const maxEnergyCount = Math.max(1, ...Object.values(energyDist));
  const totalLogged = totalDaysLogged(allEntries);
  const overallAverage =
    entries.length > 0 ? entries.reduce((s, e) => s + e.mood, 0) / entries.length : null;

  const tagRows = Array.from(byTag.entries()).sort((a, b) => b[1] - a[1]);
  const symptomRows = Array.from(symptomFreq.entries()).sort((a, b) => b[1] - a[1]);
  const hasEnergyData = Object.values(energyDist).some((c) => c > 0);
  const rangeLabel = RANGE_OPTIONS.find((r) => r.days === rangeDays)?.label ?? 'Todo';

  return (
    <Screen>
      <header className="pt-6 pb-4">
        <h1 className="text-2xl font-semibold">Insights</h1>
      </header>

      <button
        type="button"
        onClick={onOpenBrowse}
        className="card card-tappable w-full text-left rounded-xl p-4 mb-3 flex items-center justify-between"
      >
        <span className="text-sm font-medium">Ver días por humor</span>
        <span aria-hidden="true">›</span>
      </button>

      {cycleTrackingEnabled && (
        <button
          type="button"
          onClick={onOpenCycle}
          className="card card-tappable w-full text-left rounded-xl p-4 mb-6 flex items-center justify-between"
        >
          <span className="text-sm font-medium">🩸 Ver ciclo</span>
          <span aria-hidden="true">›</span>
        </button>
      )}

      {/* Todo lo de abajo se calcula sobre este rango — explícito, no implícito. */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {RANGE_OPTIONS.map((opt) => (
          <Chip
            key={opt.label}
            label={opt.label}
            selected={rangeDays === opt.days}
            onClick={() => setRangeDays(opt.days)}
          />
        ))}
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
          Distribución · {rangeLabel}
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay días registrados en este rango.
          </p>
        ) : (
          <div className="space-y-1.5">
            {([5, 4, 3, 2, 1] as MoodLevel[]).map((level) => (
              <div key={level} className="flex items-center gap-2">
                <span className="text-xs w-16" style={{ color: 'var(--text-secondary)' }}>
                  {MOOD_LABEL[level]}
                </span>
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--hairline)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(distribution[level] / maxCount) * 100}%`,
                      backgroundColor: MOOD_VAR[level],
                    }}
                  />
                </div>
                <span className="text-xs tabular-nums w-6 text-right" style={{ color: 'var(--text-muted)' }}>
                  {distribution[level]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {tagRows.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Humor por tag · {rangeLabel}
          </h2>
          <div className="space-y-2">
            {tagRows.map(([tagId, avg]) => {
              const delta = overallAverage === null ? 0 : avg - overallAverage;
              return (
                <div key={tagId} className="flex items-center justify-between text-sm">
                  <span>{tagLabel(tagId)}</span>
                  <span
                    className="tabular-nums font-medium"
                    style={{ color: delta >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
                  >
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Desvío respecto del promedio de estos {rangeLabel.toLowerCase()} ({overallAverage?.toFixed(1) ?? '—'}).
          </p>
        </section>
      )}

      {hasEnergyData && (
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Energía · {rangeLabel}
          </h2>
          <div className="space-y-1.5">
            {([5, 4, 3, 2, 1] as MoodLevel[]).map((level) => (
              <div key={level} className="flex items-center gap-2">
                <span className="text-xs w-16" style={{ color: 'var(--text-secondary)' }}>
                  {level}
                </span>
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--hairline)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(energyDist[level] / maxEnergyCount) * 100}%`,
                      backgroundColor: 'var(--energy)',
                    }}
                  />
                </div>
                <span className="text-xs tabular-nums w-6 text-right" style={{ color: 'var(--text-muted)' }}>
                  {energyDist[level]}
                </span>
              </div>
            ))}
          </div>
          {avgEnergy !== null && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Promedio: {avgEnergy.toFixed(1)} de 5.
            </p>
          )}
        </section>
      )}

      {cycleTrackingEnabled && symptomRows.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Síntomas · {rangeLabel}
          </h2>
          <div className="space-y-2">
            {symptomRows.map(([symptomId, count]) => (
              <div key={symptomId} className="flex items-center justify-between text-sm">
                <span>{symptomLabel(symptomId)}</span>
                <span className="tabular-nums font-medium" style={{ color: 'var(--period)' }}>
                  {count} {count === 1 ? 'día' : 'días'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
          Cobertura
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {monthSummary.daysLogged} días registrados este mes · {totalLogged} en total.
        </p>
      </section>
    </Screen>
  );
}
