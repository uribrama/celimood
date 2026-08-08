import { db } from './schema';
import type { DateKey } from '../domain/dates';
import type { CycleDay, Flow } from '../domain/cycle';

export async function getCycleDay(date: DateKey): Promise<CycleDay | undefined> {
  return db.cycleDays.get(date);
}

export async function getAllCycleDays(): Promise<CycleDay[]> {
  return db.cycleDays.toArray();
}

export async function upsertCycleDay(
  date: DateKey,
  flow: Flow,
  symptoms: string[] = [],
  note?: string,
): Promise<CycleDay> {
  const entry: CycleDay = { date, flow, symptoms, note };
  await db.cycleDays.put(entry);
  return entry;
}

export async function deleteCycleDay(date: DateKey): Promise<void> {
  await db.cycleDays.delete(date);
}
