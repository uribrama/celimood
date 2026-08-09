import { describe, expect, it } from 'vitest';
import type { DateKey } from '../dates';
import type { Period } from '../cycle';
import {
  averageEnergy,
  averageMoodByPhase,
  averageMoodByTag,
  averageMoodByWeekday,
  energyDistribution,
  entriesByMood,
  moodDistribution,
  summarizeMonth,
  type MoodEntry,
  type MoodLevel,
} from '../mood';

function entry(
  date: string,
  mood: MoodLevel,
  tags: string[] = [],
  energy?: MoodLevel,
): MoodEntry {
  return { date: date as DateKey, mood, energy, tags, createdAt: 0, updatedAt: 0 };
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

describe('energyDistribution', () => {
  it('cuenta solo los días con energía registrada, ignora los que no la tienen', () => {
    const entries = [
      entry('2026-08-01', 5, [], 4),
      entry('2026-08-02', 3, [], 4),
      entry('2026-08-03', 2), // sin energía
    ];
    expect(energyDistribution(entries)).toEqual({ 1: 0, 2: 0, 3: 0, 4: 2, 5: 0 });
  });
});

describe('averageEnergy', () => {
  it('promedia solo los días con energía registrada', () => {
    const entries = [entry('2026-08-01', 5, [], 4), entry('2026-08-02', 3, [], 2), entry('2026-08-03', 2)];
    expect(averageEnergy(entries)).toBe(3);
  });

  it('sin ningún día con energía, devuelve null', () => {
    expect(averageEnergy([entry('2026-08-01', 5)])).toBeNull();
  });
});

describe('averageMoodByPhase', () => {
  it('agrupa por fase usando la duración real del ciclo, excluye los días unknown', () => {
    // Ciclo cerrado junio→julio, 28 días reales (junio tiene 30 días: 5→30=25, +3=28).
    const periods: Period[] = [
      { start: '2026-06-05' as DateKey, end: '2026-06-08' as DateKey },
      { start: '2026-07-03' as DateKey, end: '2026-07-06' as DateKey },
    ];
    const entries = [
      entry('2026-06-05', 5), // día 0 → menstrual
      entry('2026-06-10', 3), // día 5 → folicular
      entry('2026-06-18', 2), // día 13 → ovulatoria
      entry('2026-06-25', 4), // día 20 → lútea
      entry('2026-05-01', 1), // antes de cualquier período → unknown, se excluye
    ];
    const byPhase = averageMoodByPhase(entries, periods, null);
    expect(byPhase.get('menstrual')).toBe(5);
    expect(byPhase.get('follicular')).toBe(3);
    expect(byPhase.get('ovulatory')).toBe(2);
    expect(byPhase.get('luteal')).toBe(4);
    expect(byPhase.has('unknown')).toBe(false);
  });

  it('sin períodos, el mapa queda vacío (todo es unknown)', () => {
    expect(averageMoodByPhase([entry('2026-06-05', 5)], [], null).size).toBe(0);
  });
});

describe('averageMoodByWeekday', () => {
  it('promedia por día de semana e ignora los días sin registros', () => {
    // 2026-08-03 y 2026-08-10 son lunes; 2026-08-04 es martes.
    const entries = [entry('2026-08-03', 4), entry('2026-08-10', 2), entry('2026-08-04', 5)];
    const byWeekday = averageMoodByWeekday(entries, 1);
    expect(byWeekday[0]).toBe(3); // lunes: (4+2)/2
    expect(byWeekday[1]).toBe(5); // martes
    expect(byWeekday[2]).toBeNull(); // miércoles: sin datos
  });
});
