import type { ReactNode } from 'react';
import { useApp } from '../hooks/useApp';
import { fmtMonthLabel } from '../lib/format';
import { Icon } from './Icon';

interface HeaderProps {
  onToggleSidebar: () => void;
  onStartTutorial: () => void;
  onBrandClick: () => void;
}

export function Header({ onToggleSidebar, onStartTutorial, onBrandClick }: HeaderProps): ReactNode {
  const { currentDate, changeMonth, balHidden, toggleBalHidden } = useApp();
  return (
    <div className="header">
      <div className="header-title">
        <h1>
          <button type="button" className="brand-btn" onClick={onBrandClick}>
            finlog
          </button>
        </h1>
      </div>
      <div className="header-right">
        <button className="hamburger" onClick={onToggleSidebar} aria-label="Buka menu">
          <div className="hb-lines">
            <span />
            <span />
            <span />
          </div>
          Menu
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onStartTutorial}>
          <Icon name="help" size={15} /> Panduan
        </button>
        <button
          className="bal-toggle"
          onClick={toggleBalHidden}
          aria-label={balHidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
          title={balHidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
        >
          <Icon name={balHidden ? 'hide' : 'show'} size={17} />
        </button>
        <div className="month-nav">
          <button onClick={() => changeMonth(-1)} aria-label="Bulan sebelumnya">
            <Icon name="prev" size={16} />
          </button>
          <div className="month-label">{fmtMonthLabel(currentDate)}</div>
          <button onClick={() => changeMonth(1)} aria-label="Bulan berikutnya">
            <Icon name="next" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
