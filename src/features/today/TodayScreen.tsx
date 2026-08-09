import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoodScale } from '../../components/MoodScale';
import { DayDetailsEditor } from '../../components/DayDetailsEditor';
import { TrendChart } from '../../components/TrendChart';
import { BottomSheet } from '../../components/BottomSheet';
import { Screen } from '../../components/TabBar';
import { addDays, todayKey } from '../../domain/dates';
import type { MoodLevel } from '../../domain/mood';
import { getMoodEntry, getAllMoodEntries, upsertMoodEntry } from '../../db/moodRepo';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useTimedFlag } from '../../hooks/useTimedFlag';

const TREND_RANGE_DAYS = 30;
const INACTIVITY_TIMEOUT_MS = 20_000;

/**
 * 'entry'   — todavía no hay humor logueado hoy: solo las caras.
 * 'editing' — el editor completo, expandido.
 * 'summary' — la tendencia, con un link para volver a editar.
 */
type ViewMode = 'entry' | 'editing' | 'summary';

export function TodayScreen() {
  const today = todayKey();
  const entry = useLiveQuery(() => getMoodEntry(today), [today]);
  const allEntries = useLiveQuery(getAllMoodEntries, []) ?? [];
  const [justSaved, triggerJustSaved] = useTimedFlag(1800);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  // Feedback optimista: la cara se marca seleccionada al toque, sin esperar
  // la vuelta de IndexedDB + liveQuery. Sin esto, en un dispositivo real el
  // round-trip puede sentirse como "tuve que tocar 2 veces para que guarde".
  const [optimisticMood, setOptimisticMood] = useState<MoodLevel | null>(null);
  useEffect(() => {
    if (optimisticMood !== null && entry?.mood === optimisticMood) setOptimisticMood(null);
  }, [entry?.mood, optimisticMood]);

  const displayedMood = optimisticMood ?? entry?.mood;

  // ¿Hoy ya estaba registrado cuando ENTRASTE a esta pantalla, o lo acabás de
  // loguear en esta misma visita? Decide el punto de partida: 'summary' si ya
  // estaba (cambiaste de tab y volviste, o cerraste y reabriste la app —
  // ambos casos remontan este componente, así que salen gratis de la misma
  // lectura), 'entry' si no.
  const [viewMode, setViewMode] = useState<ViewMode>('entry');
  useEffect(() => {
    let cancelled = false;
    getMoodEntry(today).then((result) => {
      if (!cancelled) setViewMode(result !== undefined ? 'summary' : 'entry');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A los 20s de no tocar nada estando en 'editing', pasa a 'summary' solo —
  // invitaste a completar tags/energía/nota, pero si no hiciste nada en un
  // rato, mejor mostrar la tendencia que dejar el editor ahí para siempre.
  // Se pausa mientras hay foco adentro (p. ej. escribiendo la nota): un
  // timer ciego podría tapar el editor a media frase.
  const lastActivityRef = useRef(Date.now());
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  useEffect(() => {
    if (viewMode !== 'editing' || hasFocusWithin) return;
    const id = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        setViewMode('summary');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [viewMode, hasFocusWithin]);

  function pingActivity() {
    lastActivityRef.current = Date.now();
  }

  const trendRangeStart = addDays(today, -TREND_RANGE_DAYS);
  const trendEntries = useMemo(
    () => allEntries.filter((e) => e.date >= trendRangeStart),
    [allEntries, trendRangeStart],
  );

  async function handleMoodSelect(mood: MoodLevel) {
    setOptimisticMood(mood);
    pingActivity();
    setViewMode('editing');
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

      <AnimatePresence mode="wait">
        {viewMode === 'editing' && entry && (
          <motion.div
            key="editor"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 overflow-hidden"
          >
            <DayDetailsEditor
              date={today}
              entry={entry}
              onActivity={pingActivity}
              onFocusWithinChange={setHasFocusWithin}
            />
          </motion.div>
        )}

        {viewMode === 'summary' && (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6"
          >
            <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Tendencia · últimos {TREND_RANGE_DAYS} días
            </h2>
            <TrendChart entries={trendEntries} rangeStart={trendRangeStart} rangeEnd={today} height={260} />
            <button
              type="button"
              onClick={() => setEditSheetOpen(true)}
              className="card card-tappable w-full text-left rounded-xl p-4 mt-4 flex items-center justify-between"
            >
              <span className="text-sm font-medium">✎ Editar detalles de hoy</span>
              <span aria-hidden="true">›</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet open={editSheetOpen} onClose={() => setEditSheetOpen(false)} title="Hoy">
        {entry && <DayDetailsEditor date={today} entry={entry} />}
      </BottomSheet>
    </Screen>
  );
}
