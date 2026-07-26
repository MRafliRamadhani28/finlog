import { useEffect, useId, type ReactNode } from 'react';
import type { TabName } from '../types';
import { Icon, type IconName } from './Icon';

/**
 * Bottom sheet dasar: muncul dari bawah, tutup dengan Escape atau tap backdrop.
 * Dipakai untuk action sheet "Mau catat apa?" dan sheet "Lainnya".
 *
 * Selalu ter-mount supaya transform bisa dianimasikan; kelas `open` yang
 * menggeser. Isi baru dibacakan screen reader saat terbuka.
 */
function Sheet({
  open,
  onClose,
  title,
  labelId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  labelId: string;
  children: ReactNode;
}): ReactNode {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  return (
    <div
      className={'sheet-overlay' + (open ? ' open' : '')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <div className="sheet-handle" />
        <div className="sheet-title" id={labelId}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

const RECORD: {
  tab: TabName;
  icon: IconName;
  title: string;
  sub: string;
  tone: 'red' | 'green' | 'yellow' | 'purple';
}[] = [
  { tab: 'pengeluaran', icon: 'expense', title: 'Pengeluaran', sub: 'Uang keluar hari ini', tone: 'red' },
  { tab: 'pemasukan', icon: 'income', title: 'Pemasukan', sub: 'Gaji, bonus, atau uang masuk lain', tone: 'green' },
  { tab: 'tunai', icon: 'cash', title: 'Tarik Tunai', sub: 'Pindah dari rekening ke dompet', tone: 'yellow' },
  { tab: 'piutang', icon: 'piutang', title: 'Piutang', sub: 'Uang yang dipinjam orang', tone: 'purple' },
];

export function ActionSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (tab: TabName) => void;
}): ReactNode {
  const labelId = useId();
  return (
    <Sheet open={open} onClose={onClose} title="Mau catat apa?" labelId={labelId}>
      <p className="sheet-sub">Pilih satu, langsung ke tempatnya.</p>
      <div className="sheet-list">
        {RECORD.map((r) => (
          <button key={r.tab} className="sheet-row" onClick={() => onPick(r.tab)}>
            <span className={'sheet-row-icon tone-' + r.tone}>
              <Icon name={r.icon} size={20} />
            </span>
            <span className="sheet-row-body">
              <span className="sheet-row-title">{r.title}</span>
              <span className="sheet-row-sub">{r.sub}</span>
            </span>
            <Icon name="next" size={18} className="sheet-row-chev" />
          </button>
        ))}
      </div>
      <button className="sheet-cancel" onClick={onClose}>
        Batal
      </button>
    </Sheet>
  );
}

/**
 * Sisa tab yang tidak masuk bottom nav, dikelompokkan sama seperti sidebar.
 * Ringkasan, Pengeluaran, dan Piutang sudah punya slot sendiri jadi tak diulang.
 */
const MORE_GROUPS: { label: string; items: { tab: TabName; icon: IconName; text: string }[] }[] = [
  {
    label: 'Transaksi',
    items: [
      { tab: 'pemasukan', icon: 'income', text: 'Pemasukan' },
      { tab: 'tunai', icon: 'cash', text: 'Tunai' },
    ],
  },
  {
    label: 'Rencanakan',
    items: [{ tab: 'rencana', icon: 'planned', text: 'Rencana' }],
  },
  {
    label: 'Kelola',
    items: [
      { tab: 'akun', icon: 'account', text: 'Akun Bank' },
      { tab: 'budget', icon: 'budget', text: 'Budget' },
      { tab: 'wishlist', icon: 'wishlist', text: 'Wishlist' },
    ],
  },
  {
    label: 'Lainnya',
    items: [
      { tab: 'data', icon: 'data', text: 'Data' },
      { tab: 'panduan', icon: 'guide', text: 'Panduan' },
    ],
  },
];

export function MoreSheet({
  open,
  onClose,
  active,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  active: TabName;
  onPick: (tab: TabName) => void;
}): ReactNode {
  const labelId = useId();
  return (
    <Sheet open={open} onClose={onClose} title="Lainnya" labelId={labelId}>
      {MORE_GROUPS.map((group) => (
        <div key={group.label} className="sheet-group">
          <div className="sheet-group-label">{group.label}</div>
          <div className="sheet-grid">
            {group.items.map((it) => (
              <button
                key={it.tab}
                className={'sheet-tile' + (active === it.tab ? ' active' : '')}
                onClick={() => onPick(it.tab)}
                aria-current={active === it.tab ? 'page' : undefined}
              >
                <Icon name={it.icon} size={18} />
                {it.text}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
