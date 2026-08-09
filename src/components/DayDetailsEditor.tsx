import { motion } from 'framer-motion';
import { EnergyScale } from './EnergyScale';
import { Chip } from './Chip';
import { InlineConfirmation } from './InlineConfirmation';
import { useTimedFlag } from '../hooks/useTimedFlag';
import type { DateKey } from '../domain/dates';
import type { MoodEntry, MoodLevel } from '../domain/mood';
import { upsertMoodEntry } from '../db/moodRepo';
import { getCycleDay, upsertCycleDay } from '../db/cycleRepo';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/schema';

/** Valor de "flujo" que representa período on/off en la UI simplificada — el
 * dominio sigue modelando 5 niveles de flujo, la UI solo expone un
 * interruptor, así que "prendido" guarda este valor (SPEC.md §9 cerradas). */
const PERIOD_ON_FLOW = 'medium';

type DayDetailsEditorProps = {
  date: DateKey;
  entry: MoodEntry;
  /** Se llama en cada guardado — Hoy lo usa para resetear el timer de
   * inactividad que colapsa el editor a la tendencia (ver TodayScreen). */
  onActivity?: () => void;
  /** true mientras la nota tiene el foco — Hoy pausa el timer de inactividad
   * con esto, para no tapar el editor con la tendencia a media frase. No se
   * usa foco genérico de todo el editor: un botón (Energía, un tag) también
   * recibe foco al tocarlo y se queda así hasta el próximo tap, lo que
   * pausaría el timer para siempre sin que el usuario esté "haciendo" nada. */
  onFocusWithinChange?: (hasFocus: boolean) => void;
};

/**
 * Energía + Tags + Período/Síntomas + Nota de un día — compartido entre Hoy
 * y el editor de días pasados del calendario, para que ambos editen exactamente
 * lo mismo en vez de que el calendario solo deje tocar el emoji.
 */
export function DayDetailsEditor({ date, entry, onActivity, onFocusWithinChange }: DayDetailsEditorProps) {
  const tags = useLiveQuery(() => db.tags.filter((t) => !t.archived).toArray(), []);
  const symptomCatalog = useLiveQuery(() => db.symptoms.filter((s) => !s.archived).toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('singleton'), []);
  const cycleDay = useLiveQuery(() => getCycleDay(date), [date]);

  const [energySaved, triggerEnergySaved] = useTimedFlag(1500);
  const [tagsSaved, triggerTagsSaved] = useTimedFlag(1500);
  const [periodSaved, triggerPeriodSaved] = useTimedFlag(1500);
  const [noteSaved, triggerNoteSaved] = useTimedFlag(1800);

  const selectedTags = new Set(entry.tags);
  const selectedSymptoms = new Set(cycleDay?.symptoms ?? []);
  const periodOn = cycleDay?.flow !== undefined && cycleDay.flow !== 'none';

  // Vibración corta en cada guardado — señal física además de la visual,
  // para que un "¿esto se guardó?" no dependa solo de ver el textito verde.
  function buzz() {
    if ('vibrate' in navigator) navigator.vibrate(15);
  }

  async function handleEnergySelect(energy: MoodLevel) {
    onActivity?.();
    await upsertMoodEntry({ date, mood: entry.mood, energy, tags: entry.tags, note: entry.note });
    buzz();
    triggerEnergySaved();
  }

  async function toggleTag(tagId: string) {
    onActivity?.();
    const next = selectedTags.has(tagId)
      ? entry.tags.filter((t) => t !== tagId)
      : [...entry.tags, tagId];
    await upsertMoodEntry({ date, mood: entry.mood, tags: next, note: entry.note });
    buzz();
    triggerTagsSaved();
  }

  async function saveNote(value: string) {
    onActivity?.();
    await upsertMoodEntry({ date, mood: entry.mood, tags: entry.tags, note: value });
    buzz();
    triggerNoteSaved();
  }

  async function togglePeriod() {
    onActivity?.();
    await upsertCycleDay(date, periodOn ? 'none' : PERIOD_ON_FLOW, cycleDay?.symptoms ?? [], cycleDay?.note);
    buzz();
    triggerPeriodSaved();
  }

  async function toggleSymptom(id: string) {
    onActivity?.();
    const next = selectedSymptoms.has(id)
      ? (cycleDay?.symptoms ?? []).filter((s) => s !== id)
      : [...(cycleDay?.symptoms ?? []), id];
    await upsertCycleDay(date, cycleDay?.flow ?? 'none', next, cycleDay?.note);
    buzz();
    triggerPeriodSaved();
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-4 overflow-hidden"
    >
      <section>
        <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Energía (opcional)
        </h2>
        <EnergyScale value={entry.energy} onChange={handleEnergySelect} />
        <InlineConfirmation show={energySaved} message="Guardado" />
      </section>

      <section>
        <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Tags
        </h2>
        <div className="flex flex-wrap gap-2">
          {tags?.map((tag) => (
            <Chip
              key={tag.id}
              label={`${tag.emoji} ${tag.label}`}
              selected={selectedTags.has(tag.id)}
              onClick={() => toggleTag(tag.id)}
            />
          ))}
        </div>
        <InlineConfirmation show={tagsSaved} message="Guardado" />
      </section>

      {settings?.cycleTrackingEnabled && (
        <section>
          <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Período
          </h2>
          <div className="flex flex-wrap gap-2">
            <Chip label="🩸 Período" selected={periodOn} onClick={togglePeriod} />
            {symptomCatalog?.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                selected={selectedSymptoms.has(s.id)}
                onClick={() => toggleSymptom(s.id)}
              />
            ))}
          </div>
          <InlineConfirmation show={periodSaved} message="Guardado" />
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Nota (opcional)
        </h2>
        <textarea
          key={date}
          defaultValue={entry.note}
          onFocus={() => onFocusWithinChange?.(true)}
          onBlur={(e) => {
            onFocusWithinChange?.(false);
            saveNote(e.target.value);
          }}
          placeholder="¿Algo que quieras recordar de este día?"
          rows={3}
          className="card w-full rounded-xl p-3 text-sm resize-none transition-shadow focus-visible:outline-2 focus-visible:shadow-[var(--shadow-md)]"
          style={{ color: 'var(--text-primary)' }}
        />
        <InlineConfirmation show={noteSaved} message="Guardado" />
      </section>
    </motion.div>
  );
}
