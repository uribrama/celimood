import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoodScale } from '../../components/MoodScale';
import { EnergyScale } from '../../components/EnergyScale';
import { Chip } from '../../components/Chip';
import { Screen } from '../../components/TabBar';
import { todayKey } from '../../domain/dates';
import type { MoodLevel } from '../../domain/mood';
import { getMoodEntry, upsertMoodEntry } from '../../db/moodRepo';
import { getCycleDay } from '../../db/cycleRepo';
import { useLiveQuery } from '../../db/useLiveQuery';
import { db } from '../../db/schema';
import { CycleLogSheet } from '../cycle/CycleLogSheet';

export function TodayScreen() {
  const today = todayKey();
  const entry = useLiveQuery(() => getMoodEntry(today), [today]);
  const tags = useLiveQuery(() => db.tags.filter((t) => !t.archived).toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('singleton'), []);
  const cycleDay = useLiveQuery(() => getCycleDay(today), [today]);
  const [justSaved, setJustSaved] = useState(false);
  const [cycleSheetOpen, setCycleSheetOpen] = useState(false);

  const selectedTags = new Set(entry?.tags ?? []);

  async function handleMoodSelect(mood: MoodLevel) {
    await upsertMoodEntry({ date: today, mood, tags: entry?.tags, note: entry?.note });
    if ('vibrate' in navigator) navigator.vibrate(15);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  async function handleEnergySelect(energy: MoodLevel) {
    if (!entry) return;
    await upsertMoodEntry({ date: today, mood: entry.mood, energy, tags: entry.tags, note: entry.note });
  }

  async function toggleTag(tagId: string) {
    if (!entry) return;
    const next = selectedTags.has(tagId)
      ? entry.tags.filter((t) => t !== tagId)
      : [...entry.tags, tagId];
    await upsertMoodEntry({ date: today, mood: entry.mood, tags: next, note: entry.note });
  }

  async function saveNote(value: string) {
    if (!entry) return;
    await upsertMoodEntry({ date: today, mood: entry.mood, tags: entry.tags, note: value });
  }

  const dateLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen>
      <header className="pt-6 pb-4">
        <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
          {dateLabel}
        </p>
        <h1 className="text-2xl font-semibold mt-1">¿Cómo estuvo tu día?</h1>
      </header>

      <MoodScale value={entry?.mood} onChange={handleMoodSelect} />

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

      <AnimatePresence>
        {entry && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-8 space-y-5 overflow-hidden"
          >
            <section>
              <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Energía (opcional)
              </h2>
              <EnergyScale value={entry.energy} onChange={handleEnergySelect} />
            </section>

            <section>
              <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {tags?.map((tag) => (
                  <Chip
                    key={tag.id}
                    label={`${tag.emoji} ${tag.label}`}
                    selected={selectedTags.has(tag.id)}
                    onClick={() => toggleTag(tag.id)}
                  />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Nota (opcional)
              </h2>
              <textarea
                defaultValue={entry.note}
                onBlur={(e) => saveNote(e.target.value)}
                placeholder="¿Algo que quieras recordar de hoy?"
                rows={3}
                className="card w-full rounded-xl p-3 text-sm resize-none transition-shadow focus-visible:outline-2 focus-visible:shadow-[var(--shadow-md)]"
                style={{ color: 'var(--text-primary)' }}
              />
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {settings?.cycleTrackingEnabled && (
        <button
          type="button"
          onClick={() => setCycleSheetOpen(true)}
          className="card card-tappable w-full mt-6 rounded-xl p-3 text-sm font-medium flex items-center justify-between"
        >
          <span>🩸 Registrar período{cycleDay && cycleDay.flow !== 'none' ? ' ✓' : ''}</span>
          <span aria-hidden="true">›</span>
        </button>
      )}

      <CycleLogSheet
        open={cycleSheetOpen}
        onClose={() => setCycleSheetOpen(false)}
        date={today}
        cycleDay={cycleDay}
      />
    </Screen>
  );
}
