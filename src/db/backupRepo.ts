import { db } from './schema';
import {
  createBackup,
  isValidBackupFile,
  planCycleMerge,
  planMoodMerge,
  type BackupFile,
} from '../domain/backup';

export async function exportBackup(): Promise<BackupFile> {
  const [moodEntries, cycleDays] = await Promise.all([
    db.moodEntries.toArray(),
    db.cycleDays.toArray(),
  ]);
  const backup = createBackup(moodEntries, cycleDays);
  await db.settings.update('singleton', { lastExportAt: Date.now() });
  return backup;
}

export type ImportSummary = {
  newDays: number;
  conflicts: number;
  unchanged: number;
};

export type ImportMode = 'merge' | 'replace';

/** Valida ANTES de tocar la base — un JSON inválido no deja la base a medias. */
export function parseBackupFile(raw: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!isValidBackupFile(parsed)) {
    throw new Error('El archivo no tiene el formato de un backup de Celimood.');
  }
  return parsed;
}

export async function previewImport(backup: BackupFile): Promise<ImportSummary> {
  const [localMood, localCycle] = await Promise.all([
    db.moodEntries.toArray(),
    db.cycleDays.toArray(),
  ]);
  const moodPlan = planMoodMerge(localMood, backup.moodEntries);
  const cyclePlan = planCycleMerge(localCycle, backup.cycleDays);

  return {
    newDays: moodPlan.toInsert.length + cyclePlan.toWrite.length,
    conflicts: moodPlan.toUpdate.length,
    unchanged: moodPlan.unchanged.length + cyclePlan.unchanged.length,
  };
}

/** Todo el import va en UNA transacción: si algo falla, no queda a medias. */
export async function applyImport(backup: BackupFile, mode: ImportMode): Promise<void> {
  await db.transaction('rw', db.moodEntries, db.cycleDays, async () => {
    if (mode === 'replace') {
      await db.moodEntries.clear();
      await db.cycleDays.clear();
      await db.moodEntries.bulkPut(backup.moodEntries);
      await db.cycleDays.bulkPut(backup.cycleDays);
      return;
    }

    const [localMood, localCycle] = await Promise.all([
      db.moodEntries.toArray(),
      db.cycleDays.toArray(),
    ]);
    const moodPlan = planMoodMerge(localMood, backup.moodEntries);
    const cyclePlan = planCycleMerge(localCycle, backup.cycleDays);

    await db.moodEntries.bulkPut([...moodPlan.toInsert, ...moodPlan.toUpdate]);
    await db.cycleDays.bulkPut(cyclePlan.toWrite);
  });
}

export async function eraseAllData(): Promise<void> {
  await db.transaction('rw', db.moodEntries, db.cycleDays, async () => {
    await db.moodEntries.clear();
    await db.cycleDays.clear();
  });
}
