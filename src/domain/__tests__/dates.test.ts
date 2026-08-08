import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysInMonth,
  diffDays,
  endOfMonthKey,
  isDateKey,
  startOfMonthKey,
  toDateKey,
} from '../dates';

describe('toDateKey', () => {
  it('usa la fecha LOCAL, no UTC — una hora tarde no cae en el día siguiente', () => {
    // 23:30 hora local, sin importar en qué zona corra la máquina de test.
    const localLateNight = new Date(2026, 0, 15, 23, 30);
    expect(toDateKey(localLateNight)).toBe('2026-01-15');
  });

  it('no se corre de día para una fecha construida a las 00:05', () => {
    const justAfterMidnight = new Date(2026, 5, 1, 0, 5);
    expect(toDateKey(justAfterMidnight)).toBe('2026-06-01');
  });
});

describe('isDateKey', () => {
  it('acepta un DateKey válido', () => {
    expect(isDateKey('2026-08-08')).toBe(true);
  });

  it('rechaza fechas inexistentes y formatos inválidos', () => {
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('08-08-2026')).toBe(false);
    expect(isDateKey('not-a-date')).toBe(false);
  });
});

describe('addDays / diffDays', () => {
  it('suma y resta días cruzando meses', () => {
    expect(addDays('2026-01-31' as any, 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01' as any, -1)).toBe('2026-02-28');
  });

  it('cruza un año bisiesto correctamente', () => {
    expect(addDays('2028-02-28' as any, 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29' as any, 1)).toBe('2028-03-01');
  });

  it('diffDays es simétrico y consistente con addDays', () => {
    const a = '2026-08-01' as any;
    const b = addDays(a, 40);
    expect(diffDays(a, b)).toBe(40);
    expect(diffDays(b, a)).toBe(-40);
  });
});

describe('mes: startOfMonthKey / endOfMonthKey / daysInMonth', () => {
  it('calcula el primer y último día del mes', () => {
    expect(startOfMonthKey('2026-02-15' as any)).toBe('2026-02-01');
    expect(endOfMonthKey('2026-02-15' as any)).toBe('2026-02-28');
    expect(endOfMonthKey('2028-02-15' as any)).toBe('2028-02-29'); // bisiesto
  });

  it('daysInMonth devuelve todos los días en orden, sin saltos', () => {
    const days = daysInMonth('2026-04-10' as any);
    expect(days).toHaveLength(30);
    expect(days[0]).toBe('2026-04-01');
    expect(days.at(-1)).toBe('2026-04-30');
  });
});
