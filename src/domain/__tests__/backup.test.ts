import { describe, expect, it } from 'vitest';
import type { DateKey } from '../dates';
import { isValidBackupFile, planCycleMerge, planMoodMerge } from '../backup';
import type { MoodEntry } from '../mood';
import type { CycleDay } from '../cycle';

function mood(date: string, updatedAt: number, mood: 1 | 2 | 3 | 4 | 5 = 3): MoodEntry {
  return { date: date as DateKey, mood, tags: [], createdAt: updatedAt, updatedAt };
}

describe('planMoodMerge', () => {
  it('un día que no existe localmente se inserta', () => {
    const plan = planMoodMerge([], [mood('2026-08-01', 100)]);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it('en conflicto, gana el updatedAt más reciente', () => {
    const local = [mood('2026-08-01', 100)];
    const olderIncoming = [mood('2026-08-01', 50)];
    const newerIncoming = [mood('2026-08-01', 200)];

    expect(planMoodMerge(local, olderIncoming).unchanged).toEqual(['2026-08-01']);
    expect(planMoodMerge(local, newerIncoming).toUpdate).toHaveLength(1);
  });
});

describe('planCycleMerge', () => {
  it('un día idéntico no genera escritura', () => {
    const day: CycleDay = { date: '2026-08-01' as DateKey, flow: 'light', symptoms: ['colicos'] };
    const plan = planCycleMerge([day], [{ ...day }]);
    expect(plan.toWrite).toHaveLength(0);
    expect(plan.unchanged).toEqual(['2026-08-01']);
  });

  it('un día distinto se escribe (lo importado gana)', () => {
    const local: CycleDay = { date: '2026-08-01' as DateKey, flow: 'light', symptoms: [] };
    const incoming: CycleDay = { date: '2026-08-01' as DateKey, flow: 'heavy', symptoms: [] };
    const plan = planCycleMerge([local], [incoming]);
    expect(plan.toWrite).toEqual([incoming]);
  });
});

describe('isValidBackupFile', () => {
  it('acepta un archivo bien formado', () => {
    expect(
      isValidBackupFile({
        version: 1,
        exportedAt: Date.now(),
        moodEntries: [mood('2026-08-01', 1)],
        cycleDays: [],
      }),
    ).toBe(true);
  });

  it('rechaza un archivo sin el shape esperado, sin tirar una excepción', () => {
    expect(isValidBackupFile(null)).toBe(false);
    expect(isValidBackupFile({})).toBe(false);
    expect(isValidBackupFile({ version: 2, moodEntries: [], cycleDays: [] })).toBe(false);
    expect(isValidBackupFile({ version: 1, exportedAt: 1, moodEntries: [{ bad: true }], cycleDays: [] })).toBe(false);
  });
});
