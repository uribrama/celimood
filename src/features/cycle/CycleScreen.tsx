import { useMemo } from 'react';
import { Screen } from '../../components/TabBar';
import {
  deriveCycles,
  detectPeriods,
  estimatePhase,
  medianPlausibleCycleLength,
  predictNextPeriod,
} from '../../domain/cycle';
import { diffDays, todayKey } from '../../domain/dates';
import { useLiveQuery } from '../../db/useLiveQuery';
import { getAllCycleDays } from '../../db/cycleRepo';

const PHASE_LABEL: Record<string, string> = {
  menstrual: 'Menstrual',
  follicular: 'Folicular',
  ovulatory: 'Ovulatoria',
  luteal: 'Lútea',
  unknown: 'Sin datos suficientes',
};

export function CycleScreen({ onBack }: { onBack: () => void }) {
  const cycleDays = useLiveQuery(getAllCycleDays, []) ?? [];
  const periods = useMemo(() => detectPeriods(cycleDays), [cycleDays]);
  const cycles = useMemo(() => deriveCycles(periods), [periods]);
  const medianLength = useMemo(() => medianPlausibleCycleLength(cycles), [cycles]);
  const lastPeriod = periods.at(-1);
  const today = todayKey();

  const currentPhase = lastPeriod ? estimatePhase(today, lastPeriod.start, medianLength) : 'unknown';
  const dayOfCycle = lastPeriod ? diffDays(lastPeriod.start, today) + 1 : null;
  const prediction = lastPeriod ? predictNextPeriod(cycles, lastPeriod.start) : { kind: 'none' as const, reason: 'not-enough-data' as const };

  return (
    <Screen>
      <header className="pt-6 pb-4 flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Volver" className="min-w-[44px] min-h-[44px] text-xl rounded-full transition-colors hover:bg-[var(--surface-2)] active:scale-90">
          ‹
        </button>
        <h1 className="text-xl font-semibold">Ciclo</h1>
      </header>

      {!lastPeriod ? (
        <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
          <p className="text-4xl mb-3" aria-hidden="true">🩷</p>
          <p>Todavía no registraste ningún período.</p>
        </div>
      ) : (
        <>
          <div className="card rounded-2xl p-5 mb-6">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Día {dayOfCycle} de tu ciclo
            </p>
            <p className="text-lg font-semibold mt-0.5">
              Fase {PHASE_LABEL[currentPhase].toLowerCase()} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(estimada)</span>
            </p>

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
              {prediction.kind === 'none' && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Necesito un ciclo más para estimar tu próximo período.
                </p>
              )}
              {prediction.kind === 'point' && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Próximo período estimado: <strong>{prediction.nextPeriodStart}</strong>
                </p>
              )}
              {prediction.kind === 'range' && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Próximo período entre <strong>{prediction.earliestStart}</strong> y{' '}
                  <strong>{prediction.latestStart}</strong> (varía bastante mes a mes)
                </p>
              )}
            </div>
          </div>

          <section>
            <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
              Histórico de ciclos
            </h2>
            <ul className="space-y-1.5">
              {[...cycles].reverse().map((c) => (
                <li key={c.startOfThisPeriod} className="card flex items-center justify-between text-sm p-2.5 rounded-lg">
                  <span>{c.startOfThisPeriod}</span>
                  <span
                    className="tabular-nums font-medium"
                    style={{ color: c.isPlausible ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {c.lengthInDays} días{!c.isPlausible && ' · atípico'}
                  </span>
                </li>
              ))}
              {cycles.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Con un solo período todavía no hay una duración de ciclo para mostrar.
                </p>
              )}
            </ul>
          </section>
        </>
      )}
    </Screen>
  );
}
