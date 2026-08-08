import { useMemo, useState } from 'react';
import { Screen } from '../../components/TabBar';
import { Chip } from '../../components/Chip';
import { MOOD_EMOJI, MOOD_LABEL, entriesByMood, moodDistribution, type MoodLevel } from '../../domain/mood';
import { useLiveQuery } from '../../db/useLiveQuery';
import { getAllMoodEntries } from '../../db/moodRepo';

const ALL_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export function BrowseScreen({ onBack }: { onBack: () => void }) {
  const entries = useLiveQuery(getAllMoodEntries, []) ?? [];
  const [selected, setSelected] = useState<Set<MoodLevel>>(new Set());

  const distribution = useMemo(() => moodDistribution(entries), [entries]);
  const filtered = useMemo(
    () => entriesByMood(entries, selected.size > 0 ? Array.from(selected) : ALL_LEVELS),
    [entries, selected],
  );

  function toggle(level: MoodLevel) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  }

  return (
    <Screen>
      <header className="pt-6 pb-4 flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Volver" className="min-w-[44px] min-h-[44px] text-xl rounded-full transition-colors hover:bg-[var(--surface-2)] active:scale-90">
          ‹
        </button>
        <h1 className="text-xl font-semibold">Días por humor</h1>
      </header>

      <div className="flex flex-wrap gap-2 mb-6">
        {ALL_LEVELS.map((level) => (
          <Chip
            key={level}
            label={`${MOOD_EMOJI[level]} ${MOOD_LABEL[level]}`}
            selected={selected.has(level)}
            count={distribution[level]}
            onClick={() => toggle(level)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
          <p className="text-4xl mb-3" aria-hidden="true">🔍</p>
          <p>No hay días con ese humor todavía.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((entry) => (
            <li key={entry.date} className="card card-tappable flex items-start gap-3 p-3 rounded-xl">
              <span className="text-2xl" aria-hidden="true">{MOOD_EMOJI[entry.mood]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{entry.date}</p>
                {entry.tags.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {entry.tags.join(' · ')}
                  </p>
                )}
                {entry.note && (
                  <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {entry.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
