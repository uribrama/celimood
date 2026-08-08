import type { MoodLevel } from '../domain/mood';

const MOOD_VAR: Record<MoodLevel, string> = {
  1: 'var(--mood-1)',
  2: 'var(--mood-2)',
  3: 'var(--mood-3)',
  4: 'var(--mood-4)',
  5: 'var(--mood-5)',
};

export type DayCellProps = {
  dayNumber: number;
  mood?: MoodLevel;
  periodLogged?: boolean;
  periodPredicted?: boolean;
  isToday?: boolean;
  onClick?: () => void;
};

/**
 * Un día registrado es un chip con relleno; un día sin registrar es la
 * AUSENCIA del chip — superficie desnuda, número en tinta apagada. Es una
 * distinción de forma, no de color, para que ningún ajuste de paleta futuro
 * pueda volver a confundir "Normal" con "sin datos" (SPEC.md §5.2, §6.2).
 */
export function DayCell({
  dayNumber,
  mood,
  periodLogged,
  periodPredicted,
  isToday,
  onClick,
}: DayCellProps) {
  const hasChip = mood !== undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-150 hover:scale-[1.05] active:scale-95 ${
        hasChip ? 'hover:brightness-110' : 'hover:bg-[var(--surface-2)]'
      }`}
      style={{
        // Sin chip, el fondo queda SIN declarar (no 'transparent' fijo): así
        // la clase hover de arriba puede pintarlo — un inline value siempre
        // le gana a :hover en CSS, y el hover es la única señal de "esto se
        // puede tocar" ahora que el borde estático se sacó (ver comentario
        // de abajo).
        backgroundColor: hasChip ? MOOD_VAR[mood] : undefined,
        // Sin registrar y sin predicción = superficie desnuda, SIN borde: la
        // ausencia es forma/presencia, no color. Medimos que un hairline gris
        // queda a ΔE 4.9 del nivel 3 — casi indistinguible — así que ni un
        // hairline tenue puede quedar acá en reposo (SPEC.md §5.2, §6.2).
        border: periodPredicted ? `${hasChip ? 2 : 1}px dashed var(--period)` : hasChip ? undefined : 'none',
        outline: isToday ? '2px solid var(--text-primary)' : undefined,
        outlineOffset: isToday ? '1px' : undefined,
        color: hasChip ? 'var(--text-primary)' : 'var(--text-muted)',
      }}
    >
      <span>{dayNumber}</span>
      {periodLogged && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-1 rounded-full"
          style={{
            backgroundColor: 'var(--period)',
            // Anillo de 2px de superficie: separa la barra del relleno del
            // chip — sin esto, sobre un día "Horrible" en modo oscuro se
            // funden (ΔE 7.8, ver tools/derive-mood-scale.mjs).
            boxShadow: hasChip ? '0 0 0 2px var(--surface-1)' : undefined,
          }}
        />
      )}
    </button>
  );
}
