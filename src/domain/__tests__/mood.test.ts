import { describe, expect, it } from 'vitest';
import type { DateKey } from '../dates';
import {
  averageMoodByTag,
  entriesByMood,
  moodDistribution,
  summarizeMonth,
  type MoodEntry,
} from '../mood';

function entry(date: string, mood: 1 | 2 | 3 | 4 | 5, tags: string[] = []): MoodEntry {
  return { date: date as DateKey, mood, tags, createdAt: 0, updatedAt: 0 };
}

describe('summarizeMonth', () => {
  it('calcula el promedio solo sobre los días registrados', () => {
    const entries = [entry('2026-08-01', 4), entry('2026-08-02', 2)];
    const summary = summarizeMonth(entries, '2026-08-15' as DateKey);
    expect(summary.averageMood).toBe(3);
    expect(summary.daysLogged).toBe(2);
    expect(summary.daysInMonth).toBe(31);
  });

  it('marca el promedio como no confiable con poca cobertura', () => {
    const entries = [entry('2026-08-01', 5)];
    const summary = summarizeMonth(entries, '2026-08-15' as DateKey);
    expect(summary.coverageRatio).toBeCloseTo(1 / 31);
    expect(summary.isReliable).toBe(false);
  });

  it('marca confiable con >= 40% de cobertura', () => {
    const entries = Array.from({ length: 13 }, (_, i) =>
      entry(`2026-08-${String(i + 1).padStart(2, '0')}`, 3),
    );
    const summary = summarizeMonth(entries, '2026-08-20' as DateKey);
    expect(summary.coverageRatio).toBeGreaterThanOrEqual(0.4);
    expect(summary.isReliable).toBe(true);
  });

  it('sin datos del mes anterior, el delta es null (no se compara contra nada)', () => {
    const entries = [entry('2026-08-01', 4)];
    const summary = summarizeMonth(entries, '2026-08-15' as DateKey);
    expect(summary.deltaFromPreviousMonth).toBeNull();
  });

  it('calcula el delta contra el promedio del mes anterior', () => {
    const entries = [entry('2026-07-01', 2), entry('2026-08-01', 4)];
    const summary = summarizeMonth(entries, '2026-08-15' as DateKey);
    expect(summary.deltaFromPreviousMonth).toBe(2);
  });
});

describe('moodDistribution', () => {
  it('cuenta cada nivel, incluyendo los que están en cero', () => {
    const entries = [entry('2026-08-01', 5), entry('2026-08-02', 5), entry('2026-08-03', 1)];
    expect(moodDistribution(entries)).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 2 });
  });
});

describe('entriesByMood', () => {
  it('filtra por los niveles pedidos y ordena por fecha descendente', () => {
    const entries = [entry('2026-08-01', 1), entry('2026-08-03', 5), entry('2026-08-02', 1)];
    const result = entriesByMood(entries, [1]);
    expect(result.map((e) => e.date)).toEqual(['2026-08-02', '2026-08-01']);
  });
});

describe('averageMoodByTag', () => {
  it('promedia el humor de los días que llevan cada tag', () => {
    const entries = [
      entry('2026-08-01', 2, ['sueño']),
      entry('2026-08-02', 4, ['sueño', 'trabajo']),
      entry('2026-08-03', 5, ['trabajo']),
    ];
    const byTag = averageMoodByTag(entries);
    expect(byTag.get('sueño')).toBe(3);
    expect(byTag.get('trabajo')).toBe(4.5);
  });
});
