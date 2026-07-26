import type { ReactNode } from 'react';
import type { TabName } from '../types';
import { Icon, type IconName } from './Icon';

interface BottomNavProps {
  active: TabName;
  onSelect: (tab: TabName) => void;
  /** Buka action sheet "Mau catat apa?". */
  onAdd: () => void;
  /** Buka sheet "Lainnya". */
  onMore: () => void;
  moreOpen: boolean;
  /** Jumlah piutang jatuh tempo — badge kecil, hanya kalau > 0. */
  duePiutang?: number;
}

/**
 * Navigasi bawah permanen untuk mobile (< 1024px). Lima slot: empat tab cepat
 * plus tombol aksi melingkar di tengah. Sidebar tetap dipakai di desktop.
 *
 * Hanya tab aktif yang berwarna aksen; indikator bergeser lewat transisi
 * background, ikon tidak memantul.
 */
const LEFT: { tab: TabName; icon: IconName; text: string }[] = [
  { tab: 'ringkasan', icon: 'summary', text: 'Beranda' },
  { tab: 'pengeluaran', icon: 'expense', text: 'Keluar' },
];

const RIGHT: { tab: TabName; icon: IconName; text: string }[] = [
  { tab: 'piutang', icon: 'piutang', text: 'Piutang' },
];

export function BottomNav({
  active,
  onSelect,
  onAdd,
  onMore,
  moreOpen,
  duePiutang = 0,
}: BottomNavProps): ReactNode {
  const item = ({ tab, icon, text }: { tab: TabName; icon: IconName; text: string }): ReactNode => {
    const isActive = active === tab && !moreOpen;
    return (
      <button
        key={tab}
        className={'bn-item' + (isActive ? ' active' : '')}
        onClick={() => onSelect(tab)}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="bn-icon">
          <Icon name={icon} size={20} />
          {tab === 'piutang' && duePiutang > 0 && (
            <span className="bn-badge" aria-label={`${duePiutang} piutang jatuh tempo`}>
              {duePiutang}
            </span>
          )}
        </span>
        <span className="bn-label">{text}</span>
      </button>
    );
  };

  return (
    <nav className="bottom-nav" aria-label="Navigasi utama">
      {LEFT.map(item)}
      <div className="bn-fab-slot">
        <button className="bn-fab" onClick={onAdd} aria-label="Catat transaksi">
          <Icon name="add" size={24} />
        </button>
      </div>
      {RIGHT.map(item)}
      <button
        className={'bn-item' + (moreOpen ? ' active' : '')}
        onClick={onMore}
        aria-current={moreOpen ? 'page' : undefined}
      >
        <span className="bn-icon">
          <Icon name="more" size={20} />
        </span>
        <span className="bn-label">Lainnya</span>
      </button>
    </nav>
  );
}
