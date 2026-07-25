import { useLayoutEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { groupThousands, moneyEdit, onlyDigits } from '../lib/format';

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Digit polos tanpa pemisah, mis. `"500000"`. */
  value: string;
  onChange: (raw: string) => void;
};

/**
 * Input nominal rupiah yang menampilkan pemisah ribuan sambil diketik.
 *
 * `type="text"` + `inputMode="numeric"`, bukan `type="number"`: input number
 * tidak bisa memuat titik pemisah, dan spinner-nya bisa mengubah nominal tanpa
 * sengaja saat halaman di-scroll.
 *
 * `value`/`onChange` tetap berupa string digit polos, jadi pemanggil cukup
 * `parseFloat` seperti saat masih `type="number"`.
 */
export function MoneyInput({ value, onChange, ...rest }: MoneyInputProps): ReactNode {
  const ref = useRef<HTMLInputElement>(null);
  // Jumlah digit di kiri caret, disimpan saat mengetik lalu dipulihkan setelah
  // render. Tanpa ini, tiap titik pemisah yang muncul/hilang mengubah panjang
  // teks dan melempar caret ke ujung kanan.
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const target = caretDigits.current;
    if (!el || target === null) return;
    caretDigits.current = null;
    let pos = 0;
    let seen = 0;
    while (pos < el.value.length && seen < target) {
      if (el.value[pos] !== '.') seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
  });

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={groupThousands(onlyDigits(value))}
      onChange={(e) => {
        const el = e.target;
        const edit = moneyEdit(
          value,
          el.value,
          el.selectionStart ?? el.value.length,
          (e.nativeEvent as InputEvent).inputType,
        );
        caretDigits.current = edit.caretDigits;
        onChange(edit.raw);
      }}
    />
  );
}
