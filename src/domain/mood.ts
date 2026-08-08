import type { DateKey } from './dates';
import { daysInMonth, isSameMonth, previousMonthKey } from './dates';

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export type MoodEntry = {
  date: DateKey;
  mood: MoodLevel;
  energy?: MoodLevel;
  tags: string[];
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export const MOOD_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export const MOOD_LABEL: Record<MoodLevel, string> = {
  1: 'Horrible',
  2: 'Mal',
  3: 'Normal',
  4: 'Bien',
  5: 'Genial',
};

export const MOOD_EMOJI: Record<MoodLevel, string> = {
  1: '😖',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};

/** Cobertura mínima para mostrar el promedio del mes con confianza (SPEC.md §5.2). */
const MIN_COVERAGE_RATIO = 0.4;

export type MonthSummary = {
  averageMood: number | null;
  roundedMood: MoodLevel | null;
  daysLogged: number;
  daysInMonth: number;
  coverageRatio: number;
  isReliable: boolean;
  deltaFromPreviousMonth: number | null;
};

function averageOf(entries: MoodEntry[]): number | null {
  if (entries.length === 0) return null;
  return entries.reduce((sum, e) => sum + e.mood, 0) / entries.length;
}

export function summarizeMonth(allEntries: MoodEntry[], monthKey: DateKey): MonthSummary {
  const thisMonth = allEntries.filter((e) => isSameMonth(e.date, monthKey));
  const total = daysInMonth(monthKey).length;
  const average = averageOf(thisMonth);
  const coverageRatio = thisMonth.length / total;

  const prevKey = previousMonthKey(monthKey);
  const prevMonth = allEntries.filter((e) => isSameMonth(e.date, prevKey));
  const prevAverage = averageOf(prevMonth);

  return {
    averageMood: average,
    roundedMood: average === null ? null : (Math.round(average) as MoodLevel),
    daysLogged: thisMonth.length,
    daysInMonth: total,
    coverageRatio,
    isReliable: coverageRatio >= MIN_COVERAGE_RATIO,
    deltaFromPreviousMonth:
      average === null || prevAverage === null ? null : average - prevAverage,
  };
}

export function moodDistribution(entries: MoodEntry[]): Record<MoodLevel, number> {
  const dist: Record<MoodLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const e of entries) dist[e.mood]++;
  return dist;
}

export function entriesByMood(entries: MoodEntry[], moods: MoodLevel[]): MoodEntry[] {
  const wanted = new Set(moods);
  return entries.filter((e) => wanted.has(e.mood)).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function averageMoodByTag(entries: MoodEntry[]): Map<string, number> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const tag of e.tags) {
      sums.set(tag, (sums.get(tag) ?? 0) + e.mood);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const out = new Map<string, number>();
  for (const [tag, sum] of sums) out.set(tag, sum / (counts.get(tag) ?? 1));
  return out;
}

export function totalDaysLogged(entries: MoodEntry[]): number {
  return entries.length;
}
