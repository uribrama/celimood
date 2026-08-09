import { describe, expect, it } from 'vitest';
import type { DateKey } from '../dates';
import {
  deriveCycles,
  detectPeriods,
  estimatePhase,
  medianPlausibleCycleLength,
  phaseForDate,
  predictNextPeriod,
  symptomFrequency,
  type CycleDay,
  type Flow,
  type Period,
} from '../cycle';

function day(date: string, flow: Flow, symptoms: string[] = []): CycleDay {
  return { date: date as DateKey, flow, symptoms };
}

describe('detectPeriods — ausente vs. flow:none (SPEC.md §4, bug crítico)', () => {
  it('un día AUSENTE en medio de un período no lo parte en dos', () => {
    // día 4 nunca se loguea — simplemente no está en la lista.
    const days = [
      day('2026-08-01', 'heavy'),
      day('2026-08-02', 'medium'),
      day('2026-08-03', 'light'),
      // 2026-08-04 ausente
      day('2026-08-05', 'light'),
    ];
    const periods = detectPeriods(days);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toEqual({ start: '2026-08-01', end: '2026-08-05' });
  });

  it('un flow:none EXPLÍCITO en medio corta el período en dos, aunque el hueco sea de 1 día', () => {
    const days = [
      day('2026-08-01', 'heavy'),
      day('2026-08-02', 'medium'),
      day('2026-08-03', 'light'),
      day('2026-08-04', 'none'), // evidencia real de que terminó
      day('2026-08-05', 'light'), // nuevo período (o spotting aislado)
    ];
    const periods = detectPeriods(days);
    expect(periods).toHaveLength(2);
    expect(periods[0]).toEqual({ start: '2026-08-01', end: '2026-08-03' });
    expect(periods[1]).toEqual({ start: '2026-08-05', end: '2026-08-05' });
  });

  it('un hueco ausente más grande que la tolerancia corta el período', () => {
    const days = [
      day('2026-08-01', 'heavy'),
      // 08-02, 08-03, 08-04 ausentes: 3 días > tolerancia default de 1
      day('2026-08-05', 'light'),
    ];
    const periods = detectPeriods(days, 1);
    expect(periods).toHaveLength(2);
  });

  it('sin ningún día con flujo, no hay períodos', () => {
    expect(detectPeriods([day('2026-08-01', 'none')])).toEqual([]);
    expect(detectPeriods([])).toEqual([]);
  });
});

describe('deriveCycles', () => {
  it('la duración del ciclo se mide entre inicios de períodos consecutivos', () => {
    const periods = [
      { start: '2026-06-01' as DateKey, end: '2026-06-05' as DateKey },
      { start: '2026-07-02' as DateKey, end: '2026-07-06' as DateKey },
    ];
    const cycles = deriveCycles(periods);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].lengthInDays).toBe(31);
    expect(cycles[0].isPlausible).toBe(true);
  });

  it('marca como NO plausible un ciclo fantasma de pocos días', () => {
    const periods = [
      { start: '2026-06-01' as DateKey, end: '2026-06-02' as DateKey },
      { start: '2026-06-04' as DateKey, end: '2026-06-05' as DateKey }, // 3 días después
    ];
    const cycles = deriveCycles(periods);
    expect(cycles[0].lengthInDays).toBe(3);
    expect(cycles[0].isPlausible).toBe(false);
  });

  it('marca como NO plausible un ciclo demasiado largo', () => {
    const periods = [
      { start: '2026-01-01' as DateKey, end: '2026-01-05' as DateKey },
      { start: '2026-04-01' as DateKey, end: '2026-04-05' as DateKey }, // ~90 días
    ];
    const cycles = deriveCycles(periods);
    expect(cycles[0].isPlausible).toBe(false);
  });
});

describe('predictNextPeriod', () => {
  it('con menos de 2 ciclos plausibles, no predice nada', () => {
    const cycles = [
      {
        startOfThisPeriod: '2026-06-01' as DateKey,
        startOfNextPeriod: '2026-07-01' as DateKey,
        lengthInDays: 30,
        isPlausible: true,
      },
    ];
    const result = predictNextPeriod(cycles, '2026-07-01' as DateKey);
    expect(result).toEqual({ kind: 'none', reason: 'not-enough-data' });
  });

  it('usa la MEDIANA, no el promedio: un ciclo atípico no debe arrastrar la predicción', () => {
    const mk = (len: number, i: number) => ({
      startOfThisPeriod: `2026-0${i}-01` as DateKey,
      startOfNextPeriod: `2026-0${i + 1}-01` as DateKey,
      lengthInDays: len,
      isPlausible: true,
    });
    // 28, 28, 29 y un atípico de 40 (dentro del rango plausible 15-60, pero atípico)
    const cycles = [mk(28, 1), mk(28, 2), mk(29, 3), mk(40, 4)];
    const result = predictNextPeriod(cycles, '2026-05-01' as DateKey);
    // mediana de [28,28,29,40] = 28.5 → redondea a 29. El promedio (31.25 → 31)
    // hubiera dado el 1 de junio en vez del 30 de mayo: la mediana no se deja
    // arrastrar por el ciclo atípico.
    expect(result.kind).toBe('point');
    if (result.kind === 'point') {
      expect(result.nextPeriodStart).toBe('2026-05-30');
    }
  });

  it('descarta los ciclos NO plausibles del cálculo de la mediana', () => {
    const cycles = [
      { startOfThisPeriod: '2026-01-01' as DateKey, startOfNextPeriod: '2026-01-04' as DateKey, lengthInDays: 3, isPlausible: false },
      { startOfThisPeriod: '2026-02-01' as DateKey, startOfNextPeriod: '2026-03-03' as DateKey, lengthInDays: 30, isPlausible: true },
      { startOfThisPeriod: '2026-03-03' as DateKey, startOfNextPeriod: '2026-04-02' as DateKey, lengthInDays: 30, isPlausible: true },
    ];
    const result = predictNextPeriod(cycles, '2026-04-02' as DateKey);
    expect(result.kind).toBe('point');
    if (result.kind === 'point') expect(result.nextPeriodStart).toBe('2026-05-02');
  });

  it('con alta varianza entre ciclos, devuelve un rango en vez de un día único', () => {
    const mk = (len: number, i: number) => ({
      startOfThisPeriod: `2026-0${i}-01` as DateKey,
      startOfNextPeriod: `2026-0${i + 1}-01` as DateKey,
      lengthInDays: len,
      isPlausible: true,
    });
    const cycles = [mk(24, 1), mk(35, 2), mk(24, 3), mk(35, 4)];
    const result = predictNextPeriod(cycles, '2026-05-01' as DateKey);
    expect(result.kind).toBe('range');
  });
});

describe('medianPlausibleCycleLength', () => {
  it('ignora los ciclos no plausibles al calcular la mediana', () => {
    const cycles = [
      { startOfThisPeriod: '2026-01-01' as DateKey, startOfNextPeriod: '2026-01-04' as DateKey, lengthInDays: 3, isPlausible: false },
      { startOfThisPeriod: '2026-02-01' as DateKey, startOfNextPeriod: '2026-03-03' as DateKey, lengthInDays: 30, isPlausible: true },
    ];
    expect(medianPlausibleCycleLength(cycles)).toBe(30);
  });

  it('sin ciclos plausibles, devuelve null', () => {
    expect(medianPlausibleCycleLength([])).toBeNull();
  });
});

describe('estimatePhase', () => {
  it('un día anterior al último período conocido es unknown, no se le asume fase', () => {
    const phase = estimatePhase(
      '2026-01-01' as DateKey,
      '2026-02-01' as DateKey,
      28,
    );
    expect(phase).toBe('unknown');
  });

  it('sin duración de ciclo conocida, la fase es unknown', () => {
    expect(estimatePhase('2026-02-05' as DateKey, '2026-02-01' as DateKey, null)).toBe('unknown');
  });

  it('clasifica menstrual, folicular, ovulatoria y lútea dentro de un ciclo de 28 días', () => {
    const start = '2026-02-01' as DateKey;
    expect(estimatePhase('2026-02-01' as DateKey, start, 28)).toBe('menstrual');
    expect(estimatePhase('2026-02-08' as DateKey, start, 28)).toBe('follicular');
    expect(estimatePhase('2026-02-15' as DateKey, start, 28)).toBe('ovulatory');
    expect(estimatePhase('2026-02-22' as DateKey, start, 28)).toBe('luteal');
  });
});

describe('symptomFrequency', () => {
  it('cuenta cada síntoma a través de todos los días', () => {
    const days = [
      day('2026-08-01', 'medium', ['colicos', 'fatiga']),
      day('2026-08-02', 'light', ['colicos']),
      day('2026-08-03', 'none', []),
    ];
    const freq = symptomFrequency(days);
    expect(freq.get('colicos')).toBe(2);
    expect(freq.get('fatiga')).toBe(1);
    expect(freq.has('acne')).toBe(false);
  });

  it('sin días, devuelve un mapa vacío', () => {
    expect(symptomFrequency([]).size).toBe(0);
  });
});

describe('phaseForDate — fecha histórica, usa la duración REAL del ciclo', () => {
  const periods: Period[] = [
    { start: '2026-06-05' as DateKey, end: '2026-06-08' as DateKey },
    { start: '2026-07-03' as DateKey, end: '2026-07-06' as DateKey }, // ciclo de junio: 28 días
    { start: '2026-08-16' as DateKey, end: '2026-08-19' as DateKey }, // ciclo de julio: 44 días (atípico, pero real)
  ];

  it('usa la duración real del ciclo, no la mediana global, para una fecha ya cerrada', () => {
    // 2026-07-20 cae en el ciclo julio→agosto, cuya duración real es 44 días,
    // muy distinta de una mediana global que podría rondar 28-30.
    const phase = phaseForDate('2026-07-20' as DateKey, periods, 28);
    // día de ciclo = diffDays(07-03, 07-20) = 17. Con longitud real 44,
    // ovulación ≈ día 30 → cycleDay 17 cae en folicular.
    expect(phase).toBe('follicular');
  });

  it('para el ciclo actual (todavía abierto, sin período siguiente) cae a la mediana', () => {
    const phase = phaseForDate('2026-08-20' as DateKey, periods, 28);
    // día de ciclo = diffDays(08-16, 08-20) = 4 → dentro del período → menstrual
    expect(phase).toBe('menstrual');
  });

  it('una fecha anterior a cualquier período conocido es unknown', () => {
    expect(phaseForDate('2026-05-01' as DateKey, periods, 28)).toBe('unknown');
  });

  it('sin períodos en absoluto, es unknown', () => {
    expect(phaseForDate('2026-08-20' as DateKey, [], 28)).toBe('unknown');
  });
});
