/**
 * DateKey: la fecha local como "YYYY-MM-DD", nunca un timestamp.
 * Un timestamp/ISO-UTC pone un registro de las 23:00 en el día siguiente para
 * cualquiera que no esté en UTC, y eso rompe el calendario, la cobertura y el
 * cruce con el ciclo a la vez (SPEC.md §4). Toda construcción de DateKey pasa
 * por este archivo — ningún otro módulo llama a `new Date()` para derivar un día.
 */
export type DateKey = string & { readonly __brand: 'DateKey' };

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` as DateKey;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function isDateKey(value: string): value is DateKey {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = dateKeyToDate(value as DateKey);
  if (Number.isNaN(d.getTime())) return false;
  // `new Date(y, m, d)` normaliza fechas inválidas (30 de feb → 2 de marzo) en
  // vez de fallar. El chequeo de ida y vuelta detecta ese desborde silencioso.
  return toDateKey(d) === value;
}

/** Medianoche local del DateKey — nunca UTC. */
export function dateKeyToDate(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = dateKeyToDate(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Días entre dos DateKey (b - a). Positivo si b es posterior. */
export function diffDays(a: DateKey, b: DateKey): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const da = dateKeyToDate(a).getTime();
  const db = dateKeyToDate(b).getTime();
  return Math.round((db - da) / msPerDay);
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function startOfMonthKey(key: DateKey): DateKey {
  const d = dateKeyToDate(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonthKey(key: DateKey): DateKey {
  const d = dateKeyToDate(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Todos los DateKey del mes que contiene `key`, en orden. */
export function daysInMonth(key: DateKey): DateKey[] {
  const start = dateKeyToDate(startOfMonthKey(key));
  const end = dateKeyToDate(endOfMonthKey(key));
  const out: DateKey[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(toDateKey(d));
  }
  return out;
}

export function monthLabel(key: DateKey, locale = 'es-AR'): string {
  return dateKeyToDate(key).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function previousMonthKey(key: DateKey): DateKey {
  const d = dateKeyToDate(startOfMonthKey(key));
  d.setMonth(d.getMonth() - 1);
  return toDateKey(d);
}

export function nextMonthKey(key: DateKey): DateKey {
  const d = dateKeyToDate(startOfMonthKey(key));
  d.setMonth(d.getMonth() + 1);
  return toDateKey(d);
}

export function isSameMonth(a: DateKey, b: DateKey): boolean {
  return startOfMonthKey(a) === startOfMonthKey(b);
}

export function weekdayIndex(key: DateKey, weekStartsOn: 0 | 1 = 1): number {
  const jsDay = dateKeyToDate(key).getDay(); // 0 = domingo
  return weekStartsOn === 1 ? (jsDay + 6) % 7 : jsDay;
}
