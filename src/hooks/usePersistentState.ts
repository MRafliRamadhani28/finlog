import { useCallback, useMemo, useRef, useState } from 'react';

export interface PersistentState<T> {
  value: T;
  update: (mutate: (draft: T) => void) => void;
  replace: (next: T) => void;
  reload: () => void;
}

/**
 * State yang write-through ke localStorage lewat fungsi load/save yang diberikan.
 * `update` menerima mutator gaya app lama (`d => { d.x = ... }`) dan bekerja di
 * atas salinan, jadi state React tetap immutable.
 *
 * Dua hal yang disengaja:
 *
 * 1. Write-through, bukan `useEffect` — render pertama tidak akan pernah
 *    menimpa data user dengan nilai default.
 * 2. Ganti `key` (navigasi bulan) di-handle SAAT RENDER, bukan di efek. Kalau
 *    lewat efek, ada satu render di mana `key` sudah bulan baru tapi `value`
 *    masih bulan lama — `update()` di jendela itu menulis data bulan lama ke
 *    key bulan baru.
 */
export function usePersistentState<T>(
  key: string,
  load: (key: string) => T,
  save: (key: string, value: T) => void,
): PersistentState<T> {
  const [state, setState] = useState<{ key: string; value: T }>(() => ({
    key,
    value: load(key),
  }));

  let current = state;
  if (state.key !== key) {
    current = { key, value: load(key) };
    setState(current);
  }

  const value = current.value;
  const ref = useRef(value);
  ref.current = value;

  const replace = useCallback(
    (next: T) => {
      save(key, next);
      ref.current = next;
      setState({ key, value: next });
    },
    [key, save],
  );

  const update = useCallback(
    (mutate: (draft: T) => void) => {
      const draft = structuredClone(ref.current);
      mutate(draft);
      replace(draft);
    },
    [replace],
  );

  const reload = useCallback(() => {
    const loaded = load(key);
    ref.current = loaded;
    setState({ key, value: loaded });
  }, [key, load]);

  // Identitas objek harus stabil: dia jadi dependency `useMemo` context di
  // useApp. Objek literal baru tiap render bikin memo itu tidak pernah bekerja.
  return useMemo(
    () => ({ value, update, replace, reload }),
    [value, update, replace, reload],
  );
}
