import { db } from './schema';
import type { DateKey } from '../domain/dates';
import type { MoodEntry, MoodLevel } from '../domain/mood';
import { maybeRequestPersistentStorage } from './storagePersistence';

export async function getMoodEntry(date: DateKey): Promise<MoodEntry | undefined> {
  return db.moodEntries.get(date);
}

export async function getAllMoodEntries(): Promise<MoodEntry[]> {
  return db.moodEntries.toArray();
}

export type UpsertMoodInput = {
  date: DateKey;
  mood: MoodLevel;
  energy?: MoodLevel;
  tags?: string[];
  note?: string;
};

/** Upsert: un registro por día, nunca duplica (SPEC.md §4). */
export async function upsertMoodEntry(input: UpsertMoodInput): Promise<MoodEntry> {
  const now = Date.now();
  const existing = await db.moodEntries.get(input.date);
  const entry: MoodEntry = {
    date: input.date,
    mood: input.mood,
    energy: input.energy ?? existing?.energy,
    tags: input.tags ?? existing?.tags ?? [],
    note: input.note ?? existing?.note,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.moodEntries.put(entry);
  if (!existing) {
    const total = await db.moodEntries.count();
    void maybeRequestPersistentStorage(total);
  }
  return entry;
}

export async function deleteMoodEntry(date: DateKey): Promise<void> {
  await db.moodEntries.delete(date);
}
