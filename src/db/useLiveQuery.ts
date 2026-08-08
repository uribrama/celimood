import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

/** Suscribe un componente a una query de Dexie; se re-renderiza sola al escribir. */
export function useLiveQuery<T>(querier: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();

  useEffect(() => {
    const sub = liveQuery(querier).subscribe({
      next: setValue,
      error: (err) => console.error('useLiveQuery', err),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
