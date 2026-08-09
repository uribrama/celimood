import { useMemo, useState } from 'react';
import { Screen } from '../../components/TabBar';
import { StatTile } from '../../components/StatTile';
import { DayCell } from '../../components/DayCell';
import { BottomSheet } from '../../components/BottomSheet';
import { MoodScale } from '../../components/MoodScale';
import { InlineConfirmation } from '../../components/InlineConfirmation';
import { DayDetailsEditor } from '../../components/DayDetailsEditor';
import { useTimedFlag } from '../../hooks/useTimedFlag';
import {
  addDays,
  compareDateKeys,
  daysInMonth,
  monthLabel as formatMonthLabel,
  nextMonthKey,
  previousMonthKey,
  todayKey,
  weekdayIndex,
  type DateKey,
} from '../../domain/dates';
import { summarizeMonth, type MoodEntry, type MoodLevel } from '../../domain/mood';
import { detectPeriods, predictNextPeriod, deriveCycles } from '../../domain/cycle';
import { useLiveQuery } from '../../db/useLiveQuery';
import { getAllMoodEntries, upsertMoodEntry } from '../../db/moodRepo';
import { getAllCycleDays } from '../../db/cycleRepo';

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function CalendarScreen() {
  const [monthKey, setMonthKey] = useState<DateKey>(todayKey());
  const [openDay, setOpenDay] = useState<DateKey | null>(null);
  const [daySaved, triggerDaySaved] = useTimedFlag(1500);

  const entries = useLiveQuery(getAllMoodEntries, []) ?? [];
  const cycleDays = useLiveQuery(getAllCycleDays, []) ?? [];

  const entryByDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
  const summary = useMemo(() => summarizeMonth(entries, monthKey), [entries, monthKey]);

  const periods = useMemo(() => detectPeriods(cycleDays), [cycleDays]);
  const loggedPeriodDates = useMemo(() => {
    const set = new Set<DateKey>();
    for (const p of periods) {
      let d = p.start;
      while (true) {
        set.add(d);
        if (d === p.end) break;
        d = addDays(d, 1);
      }
    }
    return set;
  }, [periods]);

  const cycles = useMemo(() => deriveCycles(periods), [periods]);
  const prediction = useMemo(() => {
    const lastPeriod = periods.at(-1);
    if (!lastPeriod) return null;
    return predictNextPeriod(cycles, lastPeriod.start);
  }, [cycles, periods]);

  const predictedDates = useMemo(() => {
    const set = new Set<DateKey>();
    if (prediction?.kind === 'point') {
      for (let i = 0; i < 5; i++) set.add(addDays(prediction.nextPeriodStart, i));
    } else if (prediction?.kind === 'range') {
      let d = prediction.earliestStart;
      while (d <= prediction.latestStart) {
        set.add(d);
        d = addDays(d, 1);
      }
    }
    return set;
  }, [prediction]);

  const days = daysInMonth(monthKey);
  const leadingBlanks = weekdayIndex(days[0], 1);
  const today = todayKey();
  const openEntry = openDay ? entryByDate.get(openDay) : undefined;
  const openDayIsFuture = openDay !== null && compareDateKeys(openDay, today) > 0;

  async function selectMood(mood: MoodLevel) {
    if (!openDay || openDayIsFuture) return;
    await upsertMoodEntry({ date: openDay, mood, tags: openEntry?.tags, note: openEntry?.note });
    triggerDaySaved();
  }

  return (
    <Screen>
      <header className="pt-6 pb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setMonthKey(previousMonthKey(monthKey))}
          className="min-w-[44px] min-h-[44px] text-xl rounded-full transition-colors hover:bg-[var(--surface-2)] active:scale-90"
        >
          ‹
        </button>
        <h1 className="text-lg font-semibold capitalize">{formatMonthLabel(monthKey)}</h1>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setMonthKey(nextMonthKey(monthKey))}
          className="min-w-[44px] min-h-[44px] text-xl rounded-full transition-colors hover:bg-[var(--surface-2)] active:scale-90"
        >
          ›
        </button>
      </header>

      <StatTile
        roundedMood={summary.roundedMood}
        average={summary.averageMood}
        delta={summary.deltaFromPreviousMonth}
        daysLogged={summary.daysLogged}
        daysInMonth={summary.daysInMonth}
        isReliable={summary.isReliable}
        monthLabel={formatMonthLabel(monthKey)}
      />

      <div className="grid grid-cols-7 gap-1.5 mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 mt-1.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`blank-${i}`} />)}
        {days.map((date) => {
          const entry: MoodEntry | undefined = entryByDate.get(date);
          return (
            <DayCell
              key={date}
              dayNumber={Number(date.slice(-2))}
              mood={entry?.mood}
              periodLogged={loggedPeriodDates.has(date)}
              periodPredicted={predictedDates.has(date) && !loggedPeriodDates.has(date)}
              isToday={date === today}
              isFuture={compareDateKeys(date, today) > 0}
              onClick={() => setOpenDay(date)}
            />
          );
        })}
      </div>

      <BottomSheet
        open={openDay !== null}
        onClose={() => setOpenDay(null)}
        title={openDay ?? undefined}
      >
        {openDayIsFuture ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>
            Todavía no llegaste a este día — no se puede registrar por adelantado.
          </p>
        ) : (
          <>
            <MoodScale value={openEntry?.mood} onChange={selectMood} />
            <InlineConfirmation show={daySaved} message="Actualizado" />
            {openDay && openEntry && (
              <div className="mt-6">
                <DayDetailsEditor date={openDay} entry={openEntry} />
              </div>
            )}
          </>
        )}
      </BottomSheet>
    </Screen>
  );
}
