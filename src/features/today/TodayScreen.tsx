import { useEffect, useMemo, useState } from 'react';
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
  // loguear en esta misma visita? La diferencia decide si se muestra el
  // editor expandido (invita a completar tags/energía/nota mientras está
  // fresco) o el resumen con la tendencia (ya volviste a mirar, no a cargar).
  // Como la pantalla se desmonta al cambiar de tab, cambiar de tab y volver
  // — o cerrar y reabrir la app — cuentan como "entrar de nuevo" gratis, sin
  // lógica extra para cada caso.
  const [hadEntryOnMount, setHadEntryOnMount] = useState<boolean | null>(null);
  const [justLoggedThisVisit, setJustLoggedThisVisit] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getMoodEntry(today).then((result) => {
      if (!cancelled) setHadEntryOnMount(result !== undefined);
    });
    return () => {
      cancelled = true;
    };
    // Solo al montar — es una lectura única para fijar el punto de partida,
    // no debe repetirse cuando `entry` cambia por culpa de nuestros propios guardados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showExpandedEditor = hadEntryOnMount === false || justLoggedThisVisit;
  const showSummary = entry !== undefined && !showExpandedEditor;

  const trendRangeStart = addDays(today, -TREND_RANGE_DAYS);
  const trendEntries = useMemo(
    () => allEntries.filter((e) => e.date >= trendRangeStart),
    [allEntries, trendRangeStart],
  );

  async function handleMoodSelect(mood: MoodLevel) {
    setOptimisticMood(mood);
    setJustLoggedThisVisit(true);
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
        {showExpandedEditor && entry && (
          <motion.div
            key="editor"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 overflow-hidden"
          >
            <DayDetailsEditor date={today} entry={entry} />
          </motion.div>
        )}

        {showSummary && (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Tendencia · últimos {TREND_RANGE_DAYS} días
              </h2>
              <button
                type="button"
                onClick={() => setEditSheetOpen(true)}
                className="text-xs font-medium underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                ✎ Editar detalles de hoy
              </button>
            </div>
            <TrendChart entries={trendEntries} rangeStart={trendRangeStart} rangeEnd={today} height={220} />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet open={editSheetOpen} onClose={() => setEditSheetOpen(false)} title="Hoy">
        {entry && <DayDetailsEditor date={today} entry={entry} />}
      </BottomSheet>
    </Screen>
  );
}
