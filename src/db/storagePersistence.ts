/**
 * Pide almacenamiento persistente al segundo día registrado, no en el primer
 * arranque (donde el permiso se niega por reflejo). SPEC.md §7: IndexedDB es
 * la única copia de datos irreemplazables, y los navegadores lo pueden
 * desalojar — esto reduce ese riesgo.
 */
export async function maybeRequestPersistentStorage(totalDaysLogged: number): Promise<void> {
  if (totalDaysLogged !== 2) return;
  if (!('storage' in navigator) || !navigator.storage.persist) return;
  const already = await navigator.storage.persisted?.();
  if (already) return;
  await navigator.storage.persist();
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!('storage' in navigator) || !navigator.storage.persisted) return false;
  return navigator.storage.persisted();
}
