import { MOOD_EMOJI, type MoodLevel } from '../domain/mood';

type StatTileProps = {
  roundedMood: MoodLevel | null;
  average: number | null;
  delta: number | null;
  daysLogged: number;
  daysInMonth: number;
  isReliable: boolean;
  monthLabel: string;
};

/**
 * El indicador de "el histórico" (SPEC.md §5.2): una cara, un número, una
 * lectura en texto plano y la cobertura — todo antes de cualquier gráfico.
 */
export function StatTile({
  roundedMood,
  average,
  delta,
  daysLogged,
  daysInMonth,
  isReliable,
  monthLabel,
}: StatTileProps) {
  if (average === null || roundedMood === null) {
    return (
      <div className="card rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl" aria-hidden="true">🌱</span>
        <p style={{ color: 'var(--text-secondary)' }}>Todavía no hay días registrados en {monthLabel}.</p>
      </div>
    );
  }

  const deltaText =
    delta === null
      ? null
      : delta > 0.05
        ? { icon: '↑', word: 'mejor', color: 'var(--status-good)' }
        : delta < -0.05
          ? { icon: '↓', word: 'peor', color: 'var(--status-critical)' }
          : { icon: '→', word: 'igual', color: 'var(--text-secondary)' };

  return (
    <div
      className="card rounded-2xl p-6 flex flex-col items-center gap-1 text-center"
      style={{ opacity: isReliable ? 1 : 0.6 }}
    >
      <span className="text-5xl" aria-hidden="true">{MOOD_EMOJI[roundedMood]}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{average.toFixed(1)}</span>
        {deltaText && (
          <span className="text-sm font-medium" style={{ color: deltaText.color }}>
            {deltaText.icon} {Math.abs(delta!).toFixed(1)}
          </span>
        )}
      </div>
      <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
        {deltaText
          ? `${monthLabel} estuvo ${deltaText.word} que el mes anterior`
          : `Promedio de ${monthLabel}`}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        {daysLogged} de {daysInMonth} días
        {!isReliable && ' · cobertura baja, el promedio puede no ser representativo'}
      </p>
    </div>
  );
}
