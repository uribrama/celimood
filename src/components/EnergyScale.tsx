import { motion } from 'framer-motion';
import { MOOD_LEVELS, type MoodLevel } from '../domain/mood';

type EnergyScaleProps = {
  value?: MoodLevel;
  onChange: (level: MoodLevel) => void;
};

const ENERGY_LABEL: Record<MoodLevel, string> = {
  1: 'Muy baja',
  2: 'Baja',
  3: 'Media',
  4: 'Alta',
  5: 'Muy alta',
};

/**
 * La energía es magnitud ORDINAL (cuánta hay), no polaridad — por eso se
 * llena progresivamente en UN solo hue, nunca reutiliza los 5 hues del humor
 * (SPEC.md §9). Tocar el nivel 3 llena 1-2-3 y deja 4-5 vacíos.
 */
export function EnergyScale({ value, onChange }: EnergyScaleProps) {
  return (
    <div role="radiogroup" aria-label="Energía">
      <div className="flex justify-between gap-1.5">
        {MOOD_LEVELS.map((level) => {
          const filled = value !== undefined && level <= value;
          return (
            <motion.button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              aria-label={`Energía: ${ENERGY_LABEL[level]}`}
              aria-pressed={value === level}
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.06 }}
              className="flex-1 min-w-0 aspect-square max-w-12 rounded-full flex items-center justify-center text-lg transition-colors duration-150"
              style={{
                backgroundColor: filled ? 'var(--energy)' : 'var(--surface-2)',
                border: filled ? 'none' : '1px solid var(--hairline)',
              }}
            >
              <span aria-hidden="true" style={{ opacity: filled ? 1 : 0.35 }}>
                ⚡
              </span>
            </motion.button>
          );
        })}
      </div>
      {value !== undefined && (
        <p className="text-xs text-center mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {ENERGY_LABEL[value]}
        </p>
      )}
    </div>
  );
}
