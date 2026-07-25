import type { ReactNode } from 'react';
import type { TabName } from '../types';
import { Icon, type IconName } from './Icon';

const NAV_GROUPS: { label: string; items: { tab: TabName; icon: IconName; text: string }[] }[] = [
  {
    label: 'Transaksi',
    items: [
      { tab: 'pemasukan', icon: 'income', text: 'Pemasukan' },
      { tab: 'pengeluaran', icon: 'expense', text: 'Pengeluaran' },
      { tab: 'tunai', icon: 'cash', text: 'Tunai' },
    ],
  },
  {
    label: 'Rencanakan',
    items: [
      { tab: 'rencana', icon: 'planned', text: 'Rencana' },
      { tab: 'piutang', icon: 'piutang', text: 'Piutang' },
    ],
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
      { tab: 'ringkasan', icon: 'summary', text: 'Ringkasan' },
      { tab: 'data', icon: 'data', text: 'Data' },
      { tab: 'panduan', icon: 'guide', text: 'Panduan' },
    ],
  },
];

interface SidebarProps {
  active: TabName;
  onSelect: (tab: TabName) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ active, onSelect, mobileOpen, onCloseMobile }: SidebarProps): ReactNode {
  return (
    <>
      <nav className={'sidebar' + (mobileOpen ? ' mobile-open' : '')} aria-label="Navigasi utama">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="nav-sep" />}
            <div className="nav-group">
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.tab}
                  className={'nav-item' + (active === item.tab ? ' active' : '')}
                  onClick={() => onSelect(item.tab)}
                  aria-current={active === item.tab ? 'page' : undefined}
                >
                  <Icon name={item.icon} size={16} className="nav-emoji" />
                  {item.text}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className={'sidebar-backdrop' + (mobileOpen ? ' open' : '')} onClick={onCloseMobile} />
    </>
  );
}
