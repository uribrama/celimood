import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Un booleano que se prende y se apaga solo después de `durationMs`. Si se
 * vuelve a disparar antes de apagarse, reinicia el timer en vez de apilar
 * timeouts — sin esto, dos disparos rápidos podían apagar el flag del
 * primero antes de que venciera el del segundo.
 */
export function useTimedFlag(durationMs: number): [boolean, () => void] {
  const [flag, setFlag] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFlag(true);
    timeoutRef.current = setTimeout(() => setFlag(false), durationMs);
  }, [durationMs]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return [flag, trigger];
}
