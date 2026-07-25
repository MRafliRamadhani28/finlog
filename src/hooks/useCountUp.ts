import { useEffect, useRef, useState } from 'react';

const EASE_OUT_CUBIC = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Menghitung angka dari nilai lama ke nilai baru.
 *
 * Bukan hiasan: saat saldo berubah karena satu transaksi, gerakan ini
 * menunjukkan ARAH dan BESAR perubahannya — informasi yang hilang kalau angka
 * hanya berganti seketika. Dinonaktifkan bila user meminta reduced motion.
 */
export function useCountUp(target: number, duration = 420): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = displayRef.current;
    if (reduced || from === target) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min((now - start) / duration, 1);
      const value = Math.round(from + (target - from) * EASE_OUT_CUBIC(t));
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
