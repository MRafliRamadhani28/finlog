import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface TutStep {
  icon: IconName;
  title: string;
  desc: ReactNode;
}

export const TUT_STEPS: TutStep[] = [
  {
    icon: 'income',
    title: 'Selamat Datang di Catatan Keuangan',
    desc: (
      <>
        Aplikasi ini mencatat <b>pemasukan, pengeluaran, rencana belanja, dan piutang</b> secara
        terorganisir. Tutorial ini butuh sekitar satu menit.
      </>
    ),
  },
  {
    icon: 'next',
    title: 'Navigasi Bulan',
    desc: (
      <>
        Tombol panah di pojok kanan atas berpindah bulan. Tiap bulan menyimpan data terpisah. Mulai
        dari bulan berjalan — sudah otomatis terpilih.
      </>
    ),
  },
  {
    icon: 'summary',
    title: 'Panel Saldo — Pusat Informasi',
    desc: (
      <>
        <b>Saldo Terkini</b> (hijau, angka terbesar) adalah uang yang benar-benar ada.{' '}
        <b>Saldo Bayangan</b> (kuning) adalah saldo setelah dikurangi semua rencana pengeluaran.
        Pantau keduanya.
      </>
    ),
  },
  {
    icon: 'account',
    title: 'Setup Akun Bank Dulu',
    desc: (
      <>
        Buka tab <b>Akun Bank</b> → tambahkan rekeningmu. Setelah itu kamu bisa membagi gaji ke
        beberapa rekening dan melacak dari rekening mana setiap pengeluaran berasal.
      </>
    ),
  },
  {
    icon: 'income',
    title: 'Catat Gaji & Alokasi Rekening',
    desc: (
      <>
        Tab <b>Pemasukan</b> → <b>Edit</b> → isi nominal gaji → Simpan. Form alokasi muncul otomatis
        untuk membagi gaji ke tiap rekening (misalnya 70% BCA, 30% BRI).
      </>
    ),
  },
  {
    icon: 'cash',
    title: 'Tarik Tunai & Rinciannya',
    desc: (
      <>
        Tab <b>Tunai</b> mencatat penarikan ATM — saldo langsung berkurang. Klik barisnya untuk
        membuka rincian: uang itu dipakai untuk apa saja.
      </>
    ),
  },
  {
    icon: 'expense',
    title: 'Pengeluaran Non-Tunai',
    desc: (
      <>
        Tab <b>Pengeluaran</b> untuk transfer, kartu debit, atau pembayaran digital. Pilih kategori
        dan rekening sumber agar laporanmu akurat.
      </>
    ),
  },
  {
    icon: 'planned',
    title: 'Rencana — Rencanakan Dulu',
    desc: (
      <>
        Di tab <b>Rencana</b>, tambahkan pengeluaran yang <i>belum terjadi</i>. Totalnya tampil
        merah di panel atas sebagai peringatan. Saat sudah dibayar, centang itemnya — otomatis
        pindah ke Pengeluaran Aktual.
      </>
    ),
  },
  {
    icon: 'piutang',
    title: 'Catat Piutang',
    desc: (
      <>
        Tab <b>Piutang</b> untuk uang yang kamu pinjamkan. Saldo langsung <b>berkurang</b>. Klik
        badge <b>Belum Lunas</b> saat dikembalikan → saldo <b>pulih otomatis</b>. Menghapus piutang
        juga menghapus entry pengeluarannya.
      </>
    ),
  },
  {
    icon: 'wishlist',
    title: 'Wishlist Impianmu',
    desc: (
      <>
        Tab <b>Wishlist</b> mencatat keinginan belanja. Set prioritas dan harga target. Klik badge
        status untuk memutar: <b>Wishlist → Ditabung → Tercapai</b>. Wishlist tidak terikat bulan.
      </>
    ),
  },
  {
    icon: 'data',
    title: 'Backup — Jangan Sampai Hilang',
    desc: (
      <>
        Data hanya tersimpan di <b>browser ini</b>. Agar tidak hilang saat ganti browser atau
        perangkat, rutin buka tab <b>Data</b> → <b>Unduh File Backup</b>. Import kapan saja untuk
        memulihkan.
      </>
    ),
  },
];

export function TutorialOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  const [current, setCurrent] = useState(0);

  const close = (): void => {
    setCurrent(0);
    onClose();
  };

  const go = (dir: number): void => {
    const next = current + dir;
    if (next < 0) return;
    if (next >= TUT_STEPS.length) {
      close();
      return;
    }
    setCurrent(next);
  };

  // Escape menutup, panah kiri/kanan berpindah langkah.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!open) return null;

  const step = TUT_STEPS[current];
  if (!step) return null;
  const isFirst = current === 0;
  const isLast = current === TUT_STEPS.length - 1;

  return (
    <div className="tut-overlay open" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className="tut-box">
        <div className="tut-body">
          <div className="tut-step-badge num">
            Langkah {current + 1} dari {TUT_STEPS.length}
          </div>
          <div className="tut-icon">
            <Icon name={step.icon} size={30} />
          </div>
          <div className="tut-title">{step.title}</div>
          <div className="tut-desc">{step.desc}</div>
          <div className="tut-dots">
            {TUT_STEPS.map((_, i) => (
              <div
                key={i}
                className={'tut-dot' + (i === current ? ' active' : i < current ? ' done' : '')}
              />
            ))}
          </div>
        </div>
        <div className="tut-actions">
          <button className="btn btn-ghost btn-sm" onClick={close}>
            Lewati
          </button>
          <div className="tut-nav">
            {!isFirst && (
              <button className="btn btn-ghost btn-sm" onClick={() => go(-1)}>
                <Icon name="prev" size={15} /> Kembali
              </button>
            )}
            <button
              className={'btn btn-sm ' + (isLast ? 'btn-green' : 'btn-primary')}
              onClick={() => go(1)}
              autoFocus
            >
              {isLast ? (
                <>
                  <Icon name="check" size={15} /> Selesai
                </>
              ) : (
                <>
                  Lanjut <Icon name="next" size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
