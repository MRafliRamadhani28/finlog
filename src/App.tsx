import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppProvider, useApp } from './hooks/useApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmProvider } from './hooks/useConfirm';
import { isOverdue } from './lib/calc';
import { openPiutangElsewhere } from './lib/crossMonth';
import { beginSession, cloudEnabled, logout, startSync, stopSync } from './lib/cloud';
import { KEYS, getFlag, loadCloudState, monthKey, setFlag } from './lib/storage';
import { toast } from './lib/toast';
import type { TabName } from './types';
import { BalancePanel } from './components/BalancePanel';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { ActionSheet, MoreSheet } from './components/ActionSheet';
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
import { LoginModal } from './components/LoginModal';

const MOBILE_BREAKPOINT = 1024;

// goey-toast menyeret framer-motion + sonner. Dimuat paralel di luar jalur
// render pertama; toast baru dipakai setelah user beraksi. Lihat lib/toast.ts.
//
// Kegagalan muat ditelan jadi komponen kosong. `lazy()` yang ditolak melempar
// melewati Suspense sampai ErrorBoundary — offline dengan chunk ini belum
// tersimpan, seluruh app jadi layar error hanya karena toast gagal dimuat.
type Toaster = typeof import('goey-toast').GooeyToaster;

const GooeyToaster = lazy(() =>
  import('goey-toast')
    .then((m) => ({ default: m.GooeyToaster }))
    .catch(() => ({ default: ((): ReactNode => null) as unknown as Toaster })),
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
  const { balHidden, data, currentDate, reloadAll } = useApp();
  // Beranda = tab ringkasan. Namanya di data tetap 'ringkasan' supaya
  // TabName dan sinyal tab lain tidak ikut berubah.
  const [tab, setTab] = useState<TabName>('ringkasan');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [cloudEmail, setCloudEmail] = useState<string | null>(
    () => loadCloudState()?.email ?? null,
  );
  const [loginOpen, setLoginOpen] = useState(false);

  const cloudExpired = useCallback(() => {
    setCloudEmail(null);
    toast.error('Sesi cloud habis. Klik logo finlog untuk login lagi.');
  }, []);

  useEffect(() => {
    if (!cloudEnabled() || !loadCloudState()) return;
    startSync(cloudExpired);
    return stopSync;
  }, [cloudExpired]);

  const loggedIn = useCallback(
    (email: string, replacedLocal: boolean) => {
      if (replacedLocal) reloadAll();
      beginSession(email, cloudExpired);
      setCloudEmail(email);
      setLoginOpen(false);
      toast.success(`Masuk sebagai ${email}`);
    },
    [reloadAll, cloudExpired],
  );

  const brandClick = useCallback(() => {
    if (!cloudEnabled()) return;
    if (!cloudEmail) {
      setLoginOpen(true);
      return;
    }
    toast.info(`Keluar dari akun ${cloudEmail}?`, {
      duration: 8000,
      displayDuration: 8000,
      action: {
        label: 'Logout',
        onClick: () => {
          void logout().then(() => {
            setCloudEmail(null);
            toast.success('Berhasil keluar');
          });
        },
      },
    });
  }, [cloudEmail]);

  // Tutorial otomatis saat pertama kali buka aplikasi.
  useEffect(() => {
    if (getFlag(KEYS.tutorialDone)) return;
    const t = setTimeout(() => setTutorialOpen(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Kunci scroll body selama sidebar mobile atau sheet terbuka.
  useEffect(() => {
    const locked = sidebarOpen || recordOpen || moreOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen, recordOpen, moreOpen]);

  const closeTutorial = useCallback(() => {
    setTutorialOpen(false);
    setFlag(KEYS.tutorialDone, true);
  }, []);

  const selectTab = useCallback((next: TabName) => {
    setTab(next);
    if (window.innerWidth <= MOBILE_BREAKPOINT) setSidebarOpen(false);
  }, []);

  // Sinyal "buka form tambah" per tab — increment saat dipilih dari action
  // sheet supaya tab yang baru aktif langsung membuka modalnya sendiri.
  const [addSignals, setAddSignals] = useState<Partial<Record<TabName, number>>>({});

  const recordPick = useCallback((next: TabName) => {
    setTab(next);
    setRecordOpen(false);
    setSidebarOpen(false);
    setAddSignals((s) => ({ ...s, [next]: (s[next] ?? 0) + 1 }));
  }, []);

  // Badge merah di slot Piutang — ikut menghitung bulan lain, karena piutang
  // yang jatuh tempo biasanya justru dicatat di bulan sebelumnya.
  const duePiutang = useMemo(() => {
    const key = monthKey(currentDate);
    const here = data.piutang.filter(isOverdue).length;
    const elsewhere = openPiutangElsewhere(key).filter((f) => isOverdue(f.piutang)).length;
    return here + elsewhere;
  }, [data, currentDate]);

  const navPick = useCallback((next: TabName) => {
    setTab(next);
    setMoreOpen(false);
    setSidebarOpen(false);
  }, []);

  return (
    <>
      <div className={'app' + (balHidden ? ' bal-hidden' : '')}>
        <Header
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onStartTutorial={() => setTutorialOpen(true)}
          onBrandClick={brandClick}
        />
        {/* Panel saldo cuma di beranda. Di tab lain dia mendorong isi tab
            yang dituju user turun setengah layar tanpa diminta. */}
        {tab === 'ringkasan' && <BalancePanel />}
        <div className="layout">
          <Sidebar
            active={tab}
            onSelect={selectTab}
            mobileOpen={sidebarOpen}
            onCloseMobile={() => setSidebarOpen(false)}
          />
          <div className="content">
            <div className="section active" key={tab}>
              <TabContent
                tab={tab}
                onStartTutorial={() => setTutorialOpen(true)}
                addSignals={addSignals}
                onRecord={recordPick}
              />
            </div>
          </div>
        </div>
      </div>
      <BottomNav
        active={tab}
        onSelect={selectTab}
        onAdd={() => {
          setMoreOpen(false);
          setRecordOpen(true);
        }}
        onMore={() => {
          setRecordOpen(false);
          setMoreOpen(true);
        }}
        moreOpen={moreOpen}
        duePiutang={duePiutang}
      />
      <ActionSheet open={recordOpen} onClose={() => setRecordOpen(false)} onPick={recordPick} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        active={tab}
        onPick={navPick}
      />
      <TutorialOverlay open={tutorialOpen} onClose={closeTutorial} />
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLoggedIn={loggedIn} />}
    </>
  );
}

function TabContent({
  tab,
  onStartTutorial,
  addSignals,
  onRecord,
}: {
  tab: TabName;
  onStartTutorial: () => void;
  addSignals: Partial<Record<TabName, number>>;
  /** Pindah tab sekaligus buka formnya — dipakai CTA empty state lintas tab. */
  onRecord: (tab: TabName) => void;
}): ReactNode {
  switch (tab) {
    case 'pemasukan':
      return <IncomeTab openAddSignal={addSignals.pemasukan} />;
    case 'pengeluaran':
      return <ExpenseTab openAddSignal={addSignals.pengeluaran} />;
    case 'tunai':
      return <CashTab openAddSignal={addSignals.tunai} />;
    case 'rencana':
      return <PlannedTab />;
    case 'piutang':
      return <PiutangTab openAddSignal={addSignals.piutang} />;
    case 'akun':
      return <AccountTab />;
    case 'budget':
      return <BudgetTab />;
    case 'wishlist':
      return <WishlistTab />;
    case 'ringkasan':
      return <SummaryTab onRecord={onRecord} />;
    case 'data':
      return <DataTab />;
    case 'panduan':
      return <GuideTab onStartTutorial={onStartTutorial} />;
  }
}
