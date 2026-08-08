import type { DateKey } from './dates';
import type { MoodEntry } from './mood';
import type { CycleDay } from './cycle';

export type BackupFile = {
  version: 1;
  exportedAt: number;
  moodEntries: MoodEntry[];
  cycleDays: CycleDay[];
};

export function createBackup(moodEntries: MoodEntry[], cycleDays: CycleDay[]): BackupFile {
  return { version: 1, exportedAt: Date.now(), moodEntries, cycleDays };
}

export function isValidBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.exportedAt === 'number' &&
    Array.isArray(v.moodEntries) &&
    Array.isArray(v.cycleDays) &&
    v.moodEntries.every(isMoodEntryShape) &&
    v.cycleDays.every(isCycleDayShape)
  );
}

function isMoodEntryShape(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const m = e as Record<string, unknown>;
  return (
    typeof m.date === 'string' &&
    typeof m.mood === 'number' &&
    Array.isArray(m.tags) &&
    typeof m.createdAt === 'number' &&
    typeof m.updatedAt === 'number'
  );
}

function isCycleDayShape(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const c = e as Record<string, unknown>;
  return typeof c.date === 'string' && typeof c.flow === 'string' && Array.isArray(c.symptoms);
}

export type MoodImportPlan = {
  toInsert: MoodEntry[];
  toUpdate: MoodEntry[];
  unchanged: DateKey[];
};

/**
 * Fusión con conflicto resuelto por `updatedAt` más reciente (SPEC.md §5.6).
 * No decide por su cuenta: el resumen ({toInsert, toUpdate, unchanged}) es lo
 * que la UI muestra ANTES de aplicar nada.
 */
export function planMoodMerge(local: MoodEntry[], incoming: MoodEntry[]): MoodImportPlan {
  const localByDate = new Map(local.map((e) => [e.date, e]));
  const toInsert: MoodEntry[] = [];
  const toUpdate: MoodEntry[] = [];
  const unchanged: DateKey[] = [];

  for (const entry of incoming) {
    const existing = localByDate.get(entry.date);
    if (!existing) {
      toInsert.push(entry);
    } else if (entry.updatedAt > existing.updatedAt) {
      toUpdate.push(entry);
    } else {
      unchanged.push(entry.date);
    }
  }

  return { toInsert, toUpdate, unchanged };
}

export type CycleImportPlan = {
  toWrite: CycleDay[];
  unchanged: DateKey[];
};

/** CycleDay no tiene updatedAt propio: en fusión, lo importado gana sobre lo local. */
export function planCycleMerge(local: CycleDay[], incoming: CycleDay[]): CycleImportPlan {
  const localByDate = new Map(local.map((d) => [d.date, d]));
  const toWrite: CycleDay[] = [];
  const unchanged: DateKey[] = [];

  for (const day of incoming) {
    const existing = localByDate.get(day.date);
    const isSame =
      existing &&
      existing.flow === day.flow &&
      existing.note === day.note &&
      existing.symptoms.length === day.symptoms.length &&
      existing.symptoms.every((s, i) => s === day.symptoms[i]);
    if (isSame) unchanged.push(day.date);
    else toWrite.push(day);
  }

  return { toWrite, unchanged };
}
