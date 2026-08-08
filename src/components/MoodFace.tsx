import { motion } from 'framer-motion';
import { MOOD_EMOJI, MOOD_LABEL, type MoodLevel } from '../domain/mood';

const MOOD_VAR: Record<MoodLevel, string> = {
  1: 'var(--mood-1)',
  2: 'var(--mood-2)',
  3: 'var(--mood-3)',
  4: 'var(--mood-4)',
  5: 'var(--mood-5)',
};

type MoodFaceProps = {
  level: MoodLevel;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showLabel?: boolean;
};

const SIZE_CLASSES: Record<NonNullable<MoodFaceProps['size']>, string> = {
  sm: 'w-9 h-9 text-lg',
  md: 'w-14 h-14 text-2xl',
  // Ancho relativo con techo, no fijo: 5 de estas en fila tienen que entrar
  // en una pantalla de ~360-390px sin desbordar (bug real: "Genial" se
  // cortaba en el borde derecho).
  lg: 'w-full max-w-16 aspect-square text-3xl',
};

/**
 * El color nunca va solo: cara + nombre (aria-label) + valor numérico
 * disponible, para sobrevivir a blanco y negro y a acromatopsia (SPEC.md §6.2).
 */
export function MoodFace({ level, selected, size = 'md', onClick, showLabel }: MoodFaceProps) {
  const label = MOOD_LABEL[level];

  const face = (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: selected ? 1.12 : 1.08, y: -2 }}
      animate={selected ? { scale: 1.12, y: 0 } : { scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2`}
      style={{
        backgroundColor: MOOD_VAR[level],
        outlineColor: MOOD_VAR[level],
        boxShadow: selected
          ? `0 0 0 3px var(--surface-1), 0 0 0 5px ${MOOD_VAR[level]}, var(--shadow-md)`
          : 'var(--shadow-sm)',
      }}
    >
      <span aria-hidden="true">{MOOD_EMOJI[level]}</span>
    </motion.button>
  );

  if (!showLabel) return face;

  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
      {face}
      <span className="text-[11px] leading-tight text-center" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}
