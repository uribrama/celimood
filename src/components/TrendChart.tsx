import { useId, useState } from 'react';
import { diffDays, type DateKey } from '../domain/dates';
import { MOOD_EMOJI, MOOD_LABEL, type MoodEntry, type MoodLevel } from '../domain/mood';

const MOOD_VAR: Record<MoodLevel, string> = {
  1: 'var(--mood-1)',
  2: 'var(--mood-2)',
  3: 'var(--mood-3)',
  4: 'var(--mood-4)',
  5: 'var(--mood-5)',
};

const WIDTH = 600;
const PAD = { top: 10, right: 10, bottom: 20, left: 26 };

type TrendChartProps = {
  entries: MoodEntry[];
  rangeStart: DateKey;
  rangeEnd: DateKey;
  /** Alto lógico del SVG — más grande en Hoy que en la lista compacta de
   * Insights. El ancho sigue siendo 100% del contenedor (responsive). */
  height?: number;
};

/**
 * Línea de conexión neutra + puntos coloreados por nivel de humor (mismo
 * lenguaje visual que el calendario) — así se lee el patrón de un vistazo
 * sin tener que pasar el mouse por cada punto para saber qué día fue bueno.
 *
 * La línea se corta entre corridas de días NO consecutivos: unir puntos
 * separados por días sin registrar dibujaría una tendencia que no existe
 * (mismo principio que "ausente ≠ dato" en SPEC.md §4/§5.2).
 */
export function TrendChart({ entries, rangeStart, rangeEnd, height = 160 }: TrendChartProps) {
  const [showTable, setShowTable] = useState(false);
  const gradientId = useId();
  const HEIGHT = height;

  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const totalDays = Math.max(1, diffDays(rangeStart, rangeEnd));

  const xFor = (date: DateKey) => {
    const i = diffDays(rangeStart, date);
    return PAD.left + (i / totalDays) * (WIDTH - PAD.left - PAD.right);
  };
  const yFor = (mood: MoodLevel) =>
    PAD.top + ((5 - mood) / 4) * (HEIGHT - PAD.top - PAD.bottom);

  // Agrupa en corridas de días consecutivos — cada hueco (día sin registrar)
  // arranca un nuevo trazo en vez de conectar a través de él.
  const runs: MoodEntry[][] = [];
  for (const entry of sorted) {
    const last = runs.at(-1);
    const prevEntry = last?.at(-1);
    if (prevEntry && diffDays(prevEntry.date, entry.date) === 1) {
      last!.push(entry);
    } else {
      runs.push([entry]);
    }
  }

  if (sorted.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        No hay días registrados en este rango.
      </p>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-1.5">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          {showTable ? 'Ver gráfico' : 'Ver como tabla'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-secondary)' }}>
                <th className="text-left font-medium py-1">Fecha</th>
                <th className="text-right font-medium py-1">Humor</th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((e) => (
                <tr key={e.date} style={{ borderTop: '1px solid var(--hairline)' }}>
                  <td className="py-1.5 tabular-nums">{e.date}</td>
                  <td className="py-1.5 text-right">
                    {MOOD_EMOJI[e.mood]} {MOOD_LABEL[e.mood]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Tendencia de humor: ${sorted.length} días registrados entre ${rangeStart} y ${rangeEnd}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--brand-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Líneas de referencia recesivas en cada nivel de humor, con el
              emoji como etiqueta — así la posición vertical se lee sola. */}
          {([1, 3, 5] as MoodLevel[]).map((level) => (
            <g key={level}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yFor(level)}
                y2={yFor(level)}
                stroke="var(--hairline)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={yFor(level)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
              >
                {MOOD_EMOJI[level]}
              </text>
            </g>
          ))}

          {/* Relleno suave bajo cada corrida */}
          {runs.map((run, i) => {
            if (run.length < 2) return null;
            const linePath = run.map((e) => `${xFor(e.date)},${yFor(e.mood)}`).join(' L ');
            const areaPath = `M ${xFor(run[0].date)},${HEIGHT - PAD.bottom} L ${linePath} L ${xFor(run.at(-1)!.date)},${HEIGHT - PAD.bottom} Z`;
            return <path key={`area-${i}`} d={areaPath} fill={`url(#${gradientId})`} stroke="none" />;
          })}

          {/* Línea de conexión, neutra — la identidad de cada día la da el punto */}
          {runs.map((run, i) => {
            if (run.length < 2) return null;
            const d = `M ${run.map((e) => `${xFor(e.date)},${yFor(e.mood)}`).join(' L ')}`;
            return (
              <path
                key={`line-${i}`}
                d={d}
                fill="none"
                stroke="var(--brand-accent)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Puntos, coloreados por nivel — mismo lenguaje que el calendario.
              Círculo invisible más grande por debajo: área de toque generosa
              sin agrandar la marca visual (marks-and-anatomy.md). */}
          {sorted.map((e) => (
            <g key={e.date}>
              <circle cx={xFor(e.date)} cy={yFor(e.mood)} r={9} fill="transparent">
                <title>
                  {e.date} · {MOOD_LABEL[e.mood]}
                </title>
              </circle>
              <circle
                cx={xFor(e.date)}
                cy={yFor(e.mood)}
                r={3.5}
                fill={MOOD_VAR[e.mood]}
                stroke="var(--surface-1)"
                strokeWidth={1.5}
              />
            </g>
          ))}

          <text x={PAD.left} y={HEIGHT - 4} fontSize="10" fill="var(--text-muted)">
            {rangeStart}
          </text>
          <text x={WIDTH - PAD.right} y={HEIGHT - 4} fontSize="10" fill="var(--text-muted)" textAnchor="end">
            {rangeEnd}
          </text>
        </svg>
      )}
    </div>
  );
}
