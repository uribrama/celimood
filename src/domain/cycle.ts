import type { DateKey } from './dates';
import { addDays, compareDateKeys, diffDays } from './dates';

export type Flow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';

export type CycleDay = {
  date: DateKey;
  flow: Flow;
  symptoms: string[];
  note?: string;
};

export type Period = {
  start: DateKey;
  end: DateKey;
};

export type Cycle = {
  /** Inicio de este período */
  startOfThisPeriod: DateKey;
  /** Inicio del período siguiente — la duración del ciclo se mide entre estos dos */
  startOfNextPeriod: DateKey;
  lengthInDays: number;
  /** false si la duración cae fuera de [MIN_PLAUSIBLE, MAX_PLAUSIBLE] */
  isPlausible: boolean;
};

const DEFAULT_GAP_TOLERANCE_DAYS = 1;
const MIN_PLAUSIBLE_CYCLE_DAYS = 15;
const MAX_PLAUSIBLE_CYCLE_DAYS = 60;
const MIN_PLAUSIBLE_CYCLES_FOR_PREDICTION = 2;
const CYCLES_USED_FOR_MEDIAN = 6;
const HIGH_VARIANCE_IQR_THRESHOLD = 4;

/**
 * Detecta períodos a partir de los días logueados.
 *
 * Regla crítica (SPEC.md §4): un día AUSENTE (no está en `days`) no es lo mismo
 * que un día con `flow: 'none'`. La tolerancia de hueco solo puentea días
 * ausentes; un 'none' explícito corta la corrida sí o sí, porque es evidencia
 * real de que el período terminó.
 */
export function detectPeriods(
  days: CycleDay[],
  gapToleranceDays = DEFAULT_GAP_TOLERANCE_DAYS,
): Period[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const flowDays = days
    .filter((d) => d.flow !== 'none')
    .map((d) => d.date)
    .sort(compareDateKeys);

  if (flowDays.length === 0) return [];

  const periods: Period[] = [];
  let start = flowDays[0];
  let end = flowDays[0];

  for (let i = 1; i < flowDays.length; i++) {
    const prev = flowDays[i - 1];
    const curr = flowDays[i];
    const gap = diffDays(prev, curr) - 1; // días estrictamente entre prev y curr

    const explicitNoneInGap = gap > 0 && hasExplicitNoneBetween(byDate, prev, curr);
    const bridgeable = gap === 0 || (!explicitNoneInGap && gap <= gapToleranceDays);

    if (bridgeable) {
      end = curr;
    } else {
      periods.push({ start, end });
      start = curr;
      end = curr;
    }
  }
  periods.push({ start, end });

  return periods;
}

function hasExplicitNoneBetween(
  byDate: Map<DateKey, CycleDay>,
  from: DateKey,
  to: DateKey,
): boolean {
  const gap = diffDays(from, to);
  for (let i = 1; i < gap; i++) {
    const day = byDate.get(addDays(from, i));
    if (day && day.flow === 'none') return true;
  }
  return false;
}

/** Duración de ciclo = días entre inicios de períodos consecutivos. */
export function deriveCycles(periods: Period[]): Cycle[] {
  const sorted = [...periods].sort((a, b) => compareDateKeys(a.start, b.start));
  const cycles: Cycle[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const lengthInDays = diffDays(sorted[i].start, sorted[i + 1].start);
    cycles.push({
      startOfThisPeriod: sorted[i].start,
      startOfNextPeriod: sorted[i + 1].start,
      lengthInDays,
      isPlausible:
        lengthInDays >= MIN_PLAUSIBLE_CYCLE_DAYS && lengthInDays <= MAX_PLAUSIBLE_CYCLE_DAYS,
    });
  }
  return cycles;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quartile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export type CyclePrediction =
  | { kind: 'none'; reason: 'not-enough-data' }
  | { kind: 'point'; nextPeriodStart: DateKey }
  | { kind: 'range'; earliestStart: DateKey; latestStart: DateKey };

/**
 * Predicción del próximo período: mediana de los últimos 3-6 ciclos PLAUSIBLES,
 * nunca el promedio — un ciclo atípico (viaje, enfermedad) arrastra el promedio
 * y desajusta la predicción por meses; la mediana lo ignora (SPEC.md §4).
 */
export function predictNextPeriod(cycles: Cycle[], lastPeriodStart: DateKey): CyclePrediction {
  const plausible = cycles.filter((c) => c.isPlausible);
  if (plausible.length < MIN_PLAUSIBLE_CYCLES_FOR_PREDICTION) {
    return { kind: 'none', reason: 'not-enough-data' };
  }

  const sample = plausible.slice(-CYCLES_USED_FOR_MEDIAN).map((c) => c.lengthInDays);
  const sortedSample = [...sample].sort((a, b) => a - b);
  const med = median(sortedSample);
  const iqr = quartile(sortedSample, 0.75) - quartile(sortedSample, 0.25);

  if (iqr > HIGH_VARIANCE_IQR_THRESHOLD) {
    return {
      kind: 'range',
      earliestStart: addDays(lastPeriodStart, Math.round(med - iqr / 2)),
      latestStart: addDays(lastPeriodStart, Math.round(med + iqr / 2)),
    };
  }

  return { kind: 'point', nextPeriodStart: addDays(lastPeriodStart, Math.round(med)) };
}

/** Mediana de las duraciones de ciclo PLAUSIBLES — la misma noción que usa
 * predictNextPeriod, expuesta para pantallas que necesitan solo el número
 * (p. ej. estimatePhase). */
export function medianPlausibleCycleLength(cycles: Cycle[]): number | null {
  const plausible = cycles.filter((c) => c.isPlausible).map((c) => c.lengthInDays);
  if (plausible.length === 0) return null;
  return median(plausible);
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'unknown';

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Folicular',
  ovulatory: 'Ovulatoria',
  luteal: 'Lútea',
  unknown: 'Sin datos suficientes',
};

/** Orden de exhibición — nunca 'unknown', que se excluye de los promedios. */
export const CYCLE_PHASES_IN_ORDER: CyclePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

/**
 * Fase estimada del ciclo para un día. Requiere el período actual/último y la
 * duración mediana — son ESTIMACIONES (SPEC.md §4), la UI las etiqueta como tales.
 * Días fuera de cualquier ciclo conocido son 'unknown', nunca se les asume una fase.
 */
export function estimatePhase(
  date: DateKey,
  lastPeriodStart: DateKey,
  medianCycleLength: number | null,
  periodLength = 5,
): CyclePhase {
  if (medianCycleLength === null) return 'unknown';
  const dayOfCycle = diffDays(lastPeriodStart, date);
  if (dayOfCycle < 0) return 'unknown';

  const cycleDay = dayOfCycle % medianCycleLength;
  const ovulationDay = medianCycleLength - 14;

  if (cycleDay < periodLength) return 'menstrual';
  if (cycleDay < ovulationDay - 1) return 'follicular';
  if (cycleDay <= ovulationDay + 1) return 'ovulatory';
  return 'luteal';
}

/**
 * Fase para una fecha HISTÓRICA arbitraria, usando la duración REAL del
 * ciclo al que perteneció esa fecha (no la mediana global) cuando se
 * conoce — más preciso que llamar a `estimatePhase` a mano para el pasado,
 * porque ahí ya sabemos cuánto duró ese ciclo en particular. Solo cae a la
 * mediana para el ciclo actual, todavía abierto (sin período siguiente que
 * lo cierre) — el mismo caso que ya resuelve `estimatePhase` para "hoy".
 */
export function phaseForDate(
  date: DateKey,
  periods: Period[],
  fallbackMedianLength: number | null,
): CyclePhase {
  const sorted = [...periods].sort((a, b) => compareDateKeys(a.start, b.start));
  let current: Period | undefined;
  let next: Period | undefined;
  for (const period of sorted) {
    if (compareDateKeys(period.start, date) <= 0) {
      current = period;
    } else {
      next = period;
      break;
    }
  }
  if (!current) return 'unknown';

  const cycleLength = next ? diffDays(current.start, next.start) : fallbackMedianLength;
  return estimatePhase(date, current.start, cycleLength);
}

/** Cuántas veces aparece cada síntoma en el rango de días dado. */
export function symptomFrequency(days: CycleDay[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const day of days) {
    for (const symptomId of day.symptoms) {
      freq.set(symptomId, (freq.get(symptomId) ?? 0) + 1);
    }
  }
  return freq;
}
