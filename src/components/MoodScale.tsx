import { MOOD_LEVELS, type MoodLevel } from '../domain/mood';
import { MoodFace } from './MoodFace';

type MoodScaleProps = {
  value?: MoodLevel;
  onChange: (level: MoodLevel) => void;
};

/** Los 5 niveles, tocables, con label siempre visible debajo. */
export function MoodScale({ value, onChange }: MoodScaleProps) {
  return (
    <div className="flex justify-between gap-1.5" role="radiogroup" aria-label="¿Cómo estuvo tu día?">
      {MOOD_LEVELS.map((level) => (
        <MoodFace
          key={level}
          level={level}
          selected={value === level}
          onClick={() => onChange(level)}
          size="lg"
          showLabel
        />
      ))}
    </div>
  );
}
