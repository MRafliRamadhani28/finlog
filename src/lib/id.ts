/**
 * ID tetap `Date.now()` supaya kompatibel dengan data lama, tapi dijamin unik
 * di dalam koleksinya.
 *
 * App lama memakai `id` dan `id + 1` untuk entry tertaut (tarik tunai, piutang).
 * Dua penambahan dalam milidetik berdekatan bisa menghasilkan id yang sama —
 * akibatnya key React duplikat dan hapus mengenai baris yang salah.
 */
export function nextId(existing: { id: number }[], from: number = Date.now()): number {
  const used = new Set(existing.map((e) => e.id));
  let id = from;
  while (used.has(id)) id++;
  return id;
}
