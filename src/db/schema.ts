import Dexie, { type EntityTable } from 'dexie';
import type { MoodEntry } from '../domain/mood';
import type { CycleDay } from '../domain/cycle';

export type Tag = {
  id: string;
  label: string;
  emoji: string;
  archived: boolean;
};

export type Symptom = {
  id: string;
  label: string;
  archived: boolean;
};

export type Settings = {
  key: 'singleton';
  theme: 'system' | 'light' | 'dark';
  cycleTrackingEnabled: boolean;
  weekStartsOn: 0 | 1;
  reminderTime?: string;
  lastExportAt?: number;
};

export const DEFAULT_TAGS: Omit<Tag, 'archived'>[] = [
  { id: 'sueno', label: 'Sueño', emoji: '😴' },
  { id: 'trabajo', label: 'Trabajo', emoji: '💼' },
  { id: 'social', label: 'Social', emoji: '👥' },
  { id: 'ejercicio', label: 'Ejercicio', emoji: '🏃' },
  { id: 'familia', label: 'Familia', emoji: '🏠' },
  { id: 'pareja', label: 'Pareja', emoji: '❤️' },
  { id: 'ocio', label: 'Ocio', emoji: '🎨' },
  { id: 'clima', label: 'Clima', emoji: '🌦️' },
];

/** Tags de versiones previas que no calzaban bien acá — se archivan, no se
 * borran (si quedaron entries con ese tag, no se pierde el dato histórico). */
const RETIRED_TAG_IDS = ['dinero', 'salud'];

export const DEFAULT_SYMPTOMS: Omit<Symptom, 'archived'>[] = [
  { id: 'colicos', label: 'Cólicos' },
  { id: 'dolor-cabeza', label: 'Dolor de cabeza' },
  { id: 'hinchazon', label: 'Hinchazón' },
  { id: 'acne', label: 'Acné' },
  { id: 'antojos', label: 'Antojos' },
  { id: 'sensibilidad', label: 'Sensibilidad' },
  { id: 'fatiga', label: 'Fatiga' },
];

class CelimoodDB extends Dexie {
  moodEntries!: EntityTable<MoodEntry, 'date'>;
  cycleDays!: EntityTable<CycleDay, 'date'>;
  tags!: EntityTable<Tag, 'id'>;
  symptoms!: EntityTable<Symptom, 'id'>;
  settings!: EntityTable<Settings, 'key'>;

  constructor() {
    super('celimood');
    this.version(1).stores({
      moodEntries: 'date, updatedAt',
      cycleDays: 'date',
      tags: 'id, archived',
      symptoms: 'id, archived',
      settings: 'key',
    });
  }
}

export const db = new CelimoodDB();

/**
 * Idempotente por diseño: React StrictMode monta los efectos dos veces en
 * desarrollo, así que esto puede correr dos veces en paralelo. `bulkPut` (a
 * diferencia de `bulkAdd`) no falla si la clave ya existe — evita la carrera
 * donde dos llamadas ven count()===0 y colisionan al escribir.
 */
export async function ensureSeedData(): Promise<void> {
  const tagCount = await db.tags.count();
  if (tagCount === 0) {
    await db.tags.bulkPut(DEFAULT_TAGS.map((t) => ({ ...t, archived: false })));
  }
  const symptomCount = await db.symptoms.count();
  if (symptomCount === 0) {
    await db.symptoms.bulkPut(DEFAULT_SYMPTOMS.map((s) => ({ ...s, archived: false })));
  }
  const settings = await db.settings.get('singleton');
  if (!settings) {
    await db.settings.put({
      key: 'singleton',
      theme: 'system',
      cycleTrackingEnabled: true,
      weekStartsOn: 1,
    });
  }

  await retireOldTags();
}

/**
 * Migración liviana: si una base ya tenía "Dinero"/"Salud" sembrados por una
 * versión anterior, los archiva (no los borra — los entries que ya los usan
 * conservan el dato). Corre siempre, no solo en el seed inicial.
 */
async function retireOldTags(): Promise<void> {
  const toRetire = await db.tags
    .where('id')
    .anyOf(RETIRED_TAG_IDS)
    .filter((t) => !t.archived)
    .toArray();
  if (toRetire.length === 0) return;
  await db.tags.bulkPut(toRetire.map((t) => ({ ...t, archived: true })));
}
