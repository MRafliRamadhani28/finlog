import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppProvider, useApp } from './hooks/useApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmProvider } from './hooks/useConfirm';
import { KEYS, getFlag, setFlag } from './lib/storage';
import type { TabName } from './types';
import { BalancePanel } from './components/BalancePanel';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { IncomeTab } from './components/IncomeTab';
import { ExpenseTab } from './components/ExpenseTab';
import { CashTab } from './components/CashTab';
import { PlannedTab } from './components/PlannedTab';
import { PiutangTab } from './components/PiutangTab';
import { AccountTab } from './components/AccountTab';
import { BudgetTab } from './components/BudgetTab';
import { WishlistTab } from './components/WishlistTab';
import { SummaryTab } from './components/SummaryTab';
import { DataTab } from './components/DataTab';
import { GuideTab } from './components/GuideTab';
import { TutorialOverlay } from './components/TutorialOverlay';

const MOBILE_BREAKPOINT = 820;

// goey-toast menyeret framer-motion + sonner. Dimuat paralel di luar jalur
// render pertama; toast baru dipakai setelah user beraksi. Lihat lib/toast.ts.
const GooeyToaster = lazy(() =>
  import('goey-toast').then((m) => ({ default: m.GooeyToaster })),
);

export function App(): ReactNode {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ConfirmProvider>
          <Shell />
          <Suspense fallback={null}>
            <GooeyToaster position="bottom-center" />
          </Suspense>
        </ConfirmProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

function Shell(): ReactNode {
  const { balHidden } = useApp();
  const [tab, setTab] = useState<TabName>('pemasukan');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Tutorial otomatis saat pertama kali buka aplikasi.
  useEffect(() => {
    if (getFlag(KEYS.tutorialDone)) return;
    const t = setTimeout(() => setTutorialOpen(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Kunci scroll body selama sidebar mobile terbuka.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const closeTutorial = useCallback(() => {
    setTutorialOpen(false);
    setFlag(KEYS.tutorialDone, true);
  }, []);

  const selectTab = useCallback((next: TabName) => {
    setTab(next);
    if (window.innerWidth <= MOBILE_BREAKPOINT) setSidebarOpen(false);
  }, []);

  return (
    <>
      <div className={'app' + (balHidden ? ' bal-hidden' : '')}>
        <Header
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onStartTutorial={() => setTutorialOpen(true)}
        />
        <BalancePanel />
        <div className="layout">
          <Sidebar
            active={tab}
            onSelect={selectTab}
            mobileOpen={sidebarOpen}
            onCloseMobile={() => setSidebarOpen(false)}
          />
          <div className="content">
            <div className="section active" key={tab}>
              <TabContent tab={tab} onStartTutorial={() => setTutorialOpen(true)} />
            </div>
          </div>
        </div>
      </div>
      <TutorialOverlay open={tutorialOpen} onClose={closeTutorial} />
    </>
  );
}

function TabContent({
  tab,
  onStartTutorial,
}: {
  tab: TabName;
  onStartTutorial: () => void;
}): ReactNode {
  switch (tab) {
    case 'pemasukan':
      return <IncomeTab />;
    case 'pengeluaran':
      return <ExpenseTab />;
    case 'tunai':
      return <CashTab />;
    case 'rencana':
      return <PlannedTab />;
    case 'piutang':
      return <PiutangTab />;
    case 'akun':
      return <AccountTab />;
    case 'budget':
      return <BudgetTab />;
    case 'wishlist':
      return <WishlistTab />;
    case 'ringkasan':
      return <SummaryTab />;
    case 'data':
      return <DataTab />;
    case 'panduan':
      return <GuideTab onStartTutorial={onStartTutorial} />;
  }
}
