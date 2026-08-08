import { useMemo } from 'react';
import { Screen } from '../../components/TabBar';
import { MOOD_LABEL, averageMoodByTag, moodDistribution, totalDaysLogged, type MoodLevel } from '../../domain/mood';
import { useLiveQuery } from '../../db/useLiveQuery';
import { getAllMoodEntries } from '../../db/moodRepo';
import { todayKey } from '../../domain/dates';
import { summarizeMonth } from '../../domain/mood';

const MOOD_VAR: Record<MoodLevel, string> = {
  1: 'var(--mood-1)',
  2: 'var(--mood-2)',
  3: 'var(--mood-3)',
  4: 'var(--mood-4)',
  5: 'var(--mood-5)',
};

type InsightsScreenProps = {
  onOpenBrowse: () => void;
  onOpenCycle: () => void;
  cycleTrackingEnabled: boolean;
};

export function InsightsScreen({ onOpenBrowse, onOpenCycle, cycleTrackingEnabled }: InsightsScreenProps) {
  const entries = useLiveQuery(getAllMoodEntries, []) ?? [];
  const distribution = useMemo(() => moodDistribution(entries), [entries]);
  const byTag = useMemo(() => averageMoodByTag(entries), [entries]);
  const monthSummary = useMemo(() => summarizeMonth(entries, todayKey()), [entries]);

  const maxCount = Math.max(1, ...Object.values(distribution));
  const totalLogged = totalDaysLogged(entries);
  const overallAverage =
    entries.length > 0 ? entries.reduce((s, e) => s + e.mood, 0) / entries.length : null;

  const tagRows = Array.from(byTag.entries()).sort((a, b) => b[1] - a[1]);

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

      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
          Distribución
        </h2>
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
      </section>

      {tagRows.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Humor por tag
          </h2>
          <div className="space-y-2">
            {tagRows.map(([tag, avg]) => {
              const delta = overallAverage === null ? 0 : avg - overallAverage;
              return (
                <div key={tag} className="flex items-center justify-between text-sm">
                  <span>{tag}</span>
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
            Desvío respecto del promedio general ({overallAverage?.toFixed(1) ?? '—'}).
          </p>
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
