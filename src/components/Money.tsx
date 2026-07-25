import type { ReactNode } from 'react';
import { fmtRp } from '../lib/format';
import { useCountUp } from '../hooks/useCountUp';

type Tone = 'green' | 'red' | 'yellow' | 'purple' | 'gold' | 'blue' | 'plain';

interface MoneyProps {
  value: number;
  tone?: Tone;
  /** Tampilkan tanda − untuk nilai negatif (fmtRp selalu absolut). */
  signed?: boolean;
  /** Selalu awali dengan − (dipakai kolom pengeluaran). */
  negative?: boolean;
  weight?: 'normal' | 'strong' | 'bold';
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  green: 'num-green',
  red: 'num-red',
  yellow: 'num-yellow',
  purple: 'num-purple',
  gold: 'num-gold',
  blue: 'num-blue',
  plain: '',
};

function classes(props: MoneyProps): string {
  return [
    'num',
    TONE_CLASS[props.tone ?? 'plain'],
    props.weight === 'bold' ? 'num-bold' : props.weight === 'strong' ? 'num-strong' : '',
    props.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Angka uang statis. Selalu mono + tabular supaya kolom tetap rata. */
export function Money(props: MoneyProps): ReactNode {
  const { value, signed, negative } = props;
  const prefix = negative ? '−' : signed && value < 0 ? '−' : '';
  return (
    <span className={classes(props)}>
      {prefix}
      {fmtRp(value)}
    </span>
  );
}

/** Angka uang yang berhitung saat berubah. Hanya untuk panel saldo. */
export function AnimatedMoney(props: MoneyProps): ReactNode {
  const shown = useCountUp(props.value);
  const prefix = props.negative ? '−' : props.signed && shown < 0 ? '−' : '';
  return (
    <span className={classes(props)}>
      {prefix}
      {fmtRp(shown)}
    </span>
  );
}
