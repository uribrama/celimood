import { BottomSheet } from '../../components/BottomSheet';
import { Chip } from '../../components/Chip';
import type { CycleDay, Flow } from '../../domain/cycle';
import { upsertCycleDay } from '../../db/cycleRepo';
import { useLiveQuery } from '../../db/useLiveQuery';
import { db } from '../../db/schema';
import type { DateKey } from '../../domain/dates';

const FLOW_OPTIONS: { value: Flow; label: string }[] = [
  { value: 'none', label: 'Nada' },
  { value: 'spotting', label: 'Manchado' },
  { value: 'light', label: 'Leve' },
  { value: 'medium', label: 'Medio' },
  { value: 'heavy', label: 'Abundante' },
];

type CycleLogSheetProps = {
  open: boolean;
  onClose: () => void;
  date: DateKey;
  cycleDay?: CycleDay;
};

export function CycleLogSheet({ open, onClose, date, cycleDay }: CycleLogSheetProps) {
  const symptoms = useLiveQuery(() => db.symptoms.filter((s) => !s.archived).toArray(), []);
  const selectedSymptoms = new Set(cycleDay?.symptoms ?? []);

  async function setFlow(flow: Flow) {
    await upsertCycleDay(date, flow, cycleDay?.symptoms ?? [], cycleDay?.note);
  }

  async function toggleSymptom(id: string) {
    const flow = cycleDay?.flow ?? 'none';
    const next = selectedSymptoms.has(id)
      ? (cycleDay?.symptoms ?? []).filter((s) => s !== id)
      : [...(cycleDay?.symptoms ?? []), id];
    await upsertCycleDay(date, flow, next, cycleDay?.note);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Registrar período">
      <div className="space-y-5">
        <section>
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Flujo
          </h3>
          <div className="flex flex-wrap gap-2">
            {FLOW_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={cycleDay?.flow === opt.value}
                onClick={() => setFlow(opt.value)}
              />
            ))}
          </div>
        </section>

        {symptoms && symptoms.length > 0 && (
          <section>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Síntomas
            </h3>
            <div className="flex flex-wrap gap-2">
              {symptoms.map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  selected={selectedSymptoms.has(s.id)}
                  onClick={() => toggleSymptom(s.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </BottomSheet>
  );
}
