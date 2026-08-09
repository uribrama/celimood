import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoodScale } from '../../components/MoodScale';
import { DayDetailsEditor } from '../../components/DayDetailsEditor';
import { Screen } from '../../components/TabBar';
import { todayKey } from '../../domain/dates';
import type { MoodLevel } from '../../domain/mood';
import { getMoodEntry, upsertMoodEntry } from '../../db/moodRepo';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useTimedFlag } from '../../hooks/useTimedFlag';

export function TodayScreen() {
  const today = todayKey();
  const entry = useLiveQuery(() => getMoodEntry(today), [today]);
  const [justSaved, triggerJustSaved] = useTimedFlag(1800);

  // Feedback optimista: la cara se marca seleccionada al toque, sin esperar
  // la vuelta de IndexedDB + liveQuery. Sin esto, en un dispositivo real el
  // round-trip puede sentirse como "tuve que tocar 2 veces para que guarde".
  const [optimisticMood, setOptimisticMood] = useState<MoodLevel | null>(null);
  useEffect(() => {
    if (optimisticMood !== null && entry?.mood === optimisticMood) setOptimisticMood(null);
  }, [entry?.mood, optimisticMood]);

  const displayedMood = optimisticMood ?? entry?.mood;

  async function handleMoodSelect(mood: MoodLevel) {
    setOptimisticMood(mood);
    if ('vibrate' in navigator) navigator.vibrate(15);
    triggerJustSaved();
    await upsertMoodEntry({ date: today, mood, tags: entry?.tags, note: entry?.note });
  }

  const dateLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen>
      <div
        className="rounded-3xl pt-5 pb-4 px-4 -mx-4"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--brand-accent) 20%, var(--surface-1)) 0%, var(--surface-1) 45%, var(--surface-1) 60%, color-mix(in srgb, var(--period) 14%, var(--surface-1)) 100%)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <header className="pb-3">
          <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
            {dateLabel}
          </p>
          <h1 className="text-2xl font-semibold mt-1">¿Cómo estuvo tu día?</h1>
        </header>

        <MoodScale value={displayedMood} onChange={handleMoodSelect} />

        <AnimatePresence>
          {justSaved && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm mt-3"
              style={{ color: 'var(--status-good)' }}
            >
              Día registrado ✌️
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {entry && (
          <div className="mt-6">
            <DayDetailsEditor date={today} entry={entry} />
          </div>
        )}
      </AnimatePresence>
    </Screen>
  );
}
