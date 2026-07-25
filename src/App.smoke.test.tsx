// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import { KEYS, monthKey } from './lib/storage';

/**
 * Smoke test render: memasang seluruh app dan berpindah ke setiap tab.
 *
 * Test di lib/ menjaga kebenaran hitungan, tapi tidak akan menangkap komponen
 * yang gagal mount (import salah, hook dipanggil di tempat keliru, kelas CSS
 * yang hilang tidak terdeteksi — tapi crash render terdeteksi). Ini pengganti
 * paling dekat dari membuka browser.
 */

const TABS = [
  'Pemasukan',
  'Pengeluaran',
  'Tunai',
  'Rencana',
  'Piutang',
  'Akun Bank',
  'Budget',
  'Wishlist',
  'Ringkasan',
  'Data',
  'Panduan',
];

let container: HTMLDivElement;
let root: Root;

function seedLocalStorage(): void {
  localStorage.clear();
  // Tutorial jangan muncul otomatis supaya tidak menutupi konten.
  localStorage.setItem(KEYS.tutorialDone, '1');
  localStorage.setItem(
    KEYS.accounts,
    JSON.stringify([{ id: 1, name: 'Utama', bank: 'BCA', number: '123', color: '#4d9fff' }]),
  );
  localStorage.setItem(
    KEYS.wishlist,
    JSON.stringify([
      {
        id: 2,
        name: 'Laptop',
        emoji: '💻',
        price: 20_000_000,
        priority: 'impian',
        status: 'saving',
        note: '',
        dateAdded: '2026-01-01',
      },
    ]),
  );
  localStorage.setItem(
    monthKey(new Date()),
    JSON.stringify({
      salary: 5_000_000,
      salaryAllocations: [{ accountId: 1, amount: 5_000_000 }],
      income: [
        {
          id: 3,
          date: '2026-07-02',
          category: 'Bonus',
          description: 'THR',
          amount: 1_000_000,
          note: '',
        },
      ],
      expenses: [
        {
          id: 4,
          date: '2026-07-03',
          category: 'Makanan',
          description: 'Makan siang',
          amount: 50_000,
          accountId: 1,
        },
        {
          id: 6,
          cashId: 5,
          date: '2026-07-04',
          category: 'Tunai',
          description: 'Tarik Tunai: ATM',
          amount: 500_000,
          accountId: 1,
          fromCash: true,
        },
        {
          id: 8,
          piutangId: 7,
          date: '2026-07-05',
          category: 'Piutang',
          description: 'Piutang ke: Budi',
          amount: 300_000,
          accountId: 1,
          fromPiutang: true,
        },
      ],
      cashWithdrawals: [
        {
          id: 5,
          date: '2026-07-04',
          accountId: 1,
          amount: 500_000,
          description: 'ATM',
          items: [{ id: 9, description: 'Kopi', category: 'Makanan', amount: 25_000 }],
        },
      ],
      planned: [
        { id: 10, category: 'Tagihan', description: 'Listrik', amount: 300_000, checked: false },
      ],
      piutang: [
        {
          id: 7,
          name: 'Budi',
          date: '2026-07-05',
          amount: 300_000,
          due: '2026-08-05',
          note: '',
          status: 'Belum Lunas',
          accountId: 1,
        },
      ],
      budgets: { Makanan: 500_000 },
    }),
  );
}

/** Bulan lalu dengan satu piutang belum lunas. Mengembalikan key-nya. */
function seedPreviousMonthPiutang(): string {
  const now = new Date();
  const key = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  localStorage.setItem(
    key,
    JSON.stringify({
      salary: 0,
      salaryAllocations: [],
      income: [],
      expenses: [
        {
          id: 21,
          piutangId: 20,
          date: '',
          category: 'Piutang',
          description: 'Piutang ke: Siti',
          amount: 750_000,
          accountId: 1,
          fromPiutang: true,
        },
      ],
      cashWithdrawals: [],
      planned: [],
      piutang: [
        {
          id: 20,
          name: 'Siti',
          date: '',
          amount: 750_000,
          due: '',
          note: '',
          status: 'Belum Lunas',
          accountId: 1,
        },
      ],
      budgets: {},
    }),
  );
  return key;
}

beforeEach(() => {
  // Laporkan reduced-motion supaya `useCountUp` langsung memakai nilai akhir.
  // Tanpa ini, saldo di DOM masih angka lama saat diperiksa: animasinya jalan
  // lewat requestAnimationFrame, yang tidak ikut selesai di dalam `act()`.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;

  seedLocalStorage();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(): void {
  act(() => {
    root.render(<App />);
  });
}

/**
 * Klik + tunggu efeknya selesai.
 *
 * `act` versi async wajib di sini: beberapa handler menunggu Promise sebelum
 * menyentuh data — `useBalanceGuard` dan `useConfirm` keduanya `await`. Dengan
 * `act` sinkron, mutasinya jalan di microtask SETELAH assertion dibaca, dan
 * test gagal padahal aplikasinya benar.
 */
async function click(el: Element | null | undefined, what: string): Promise<void> {
  expect(el, `${what} tidak ditemukan`).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
}

function clickNav(label: string): Promise<void> {
  return click(
    Array.from(container.querySelectorAll('button.nav-item')).find(
      (b) => b.textContent?.trim() === label,
    ),
    `tab "${label}"`,
  );
}

function clickSelector(selector: string): Promise<void> {
  return click(container.querySelector(selector), selector);
}

const tabText = (): string => container.querySelector('.content')!.textContent ?? '';
const balance = (): string | undefined =>
  container.querySelector('.bal-amount')?.textContent?.trim();

function readMonth(key: string): { piutang: { status: string }[]; expenses: unknown[] } {
  return JSON.parse(localStorage.getItem(key)!) as {
    piutang: { status: string }[];
    expenses: unknown[];
  };
}

/**
 * Isi input yang dikendalikan React.
 *
 * Menyetel `.value` langsung tidak cukup: React menyimpan nilai terakhir di
 * node dan menganggap event-nya bukan perubahan. Setter bawaan prototipe
 * melewati penyimpanan itu, jadi React melihatnya sebagai ketikan sungguhan.
 */
function setValue(el: Element, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const setField = (label: string, value: string): void => setValue(field(label), value);

/** Input/select di dalam `.form-group` yang labelnya cocok. */
function field(label: string): HTMLElement {
  const group = Array.from(container.querySelectorAll('.form-group')).find(
    (g) => g.querySelector('label')?.textContent?.trim() === label,
  );
  expect(group, `field "${label}" tidak ditemukan`).toBeTruthy();
  const input = group!.querySelector('input, select, textarea');
  expect(input, `field "${label}" tidak punya input`).toBeTruthy();
  return input as HTMLElement;
}

/** Klik tombol pertama yang teksnya memuat `label`. */
function clickText(label: string): Promise<void> {
  return click(
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label)),
    `tombol "${label}"`,
  );
}

/** Tombol aksi kanan di dialog konfirmasi (Hapus / Import / Lanjutkan). */
function confirmDialog(): Promise<void> {
  const actions = container.querySelectorAll('.modal-actions button');
  expect(actions.length, 'dialog konfirmasi tidak terbuka').toBeGreaterThan(1);
  return click(actions[actions.length - 1], 'tombol konfirmasi');
}

const openSettleChoice = (): Promise<void> => clickText('Tandai Lunas');

describe('render app', () => {
  it('panel saldo menampilkan angka yang benar', async () => {
    mount();
    // 5.000.000 + 1.000.000 − (50.000 + 500.000 + 300.000) = 5.150.000
    const amounts = Array.from(container.querySelectorAll('.bal-amount')).map((el) =>
      el.textContent?.trim(),
    );
    expect(amounts[0]).toBe('Rp 5.150.000');
    expect(amounts[1]).toBe('Rp 300.000');
  });

  it('semua tab bisa dibuka tanpa crash dan menampilkan isi', async () => {
    mount();
    for (const tab of TABS) {
      await clickNav(tab);
      const content = container.querySelector('.content');
      expect(content, `tab ${tab} kosong`).toBeTruthy();
      expect(content!.textContent!.length, `tab ${tab} tidak punya isi`).toBeGreaterThan(20);
    }
  });

  it('tidak ada emoji yang tersisa sebagai ikon antarmuka', async () => {
    mount();
    for (const tab of TABS) {
      await clickNav(tab);
      // Seluruh container, bukan cuma .content: dialog dan toast dirender di
      // luar area tab, dan di situlah emoji terakhir sempat lolos.
      const text = container.textContent ?? '';
      // Emoji milik user (wishlist) dikecualikan: dia berada di .wl-emoji-wrap.
      const uiText = text.replace(/💻|🌟/g, '');
      expect(uiText, `tab ${tab} masih memakai emoji sebagai ikon`).not.toMatch(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
      );
    }
  });

  it('dialog saldo tidak cukup tidak memakai emoji di judulnya', async () => {
    mount();
    await clickNav('Pengeluaran');
    await clickText('Tambah');
    setField('Deskripsi', 'Barang mahal');
    setField('Jumlah (Rp)', '99000000');
    setField('Dari Akun', '1');
    await clickText('Simpan');

    // Modal pengeluaran masih terbuka di belakangnya; dialog konfirmasi
    // dirender ConfirmProvider sesudah children, jadi dia yang terakhir.
    const dialogs = container.querySelectorAll('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1]!;
    expect(dialog.textContent).toContain('Saldo Tidak Cukup');
    expect(dialog.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('piutang bulan lain menanyakan ke bulan mana pelunasannya dicatat', async () => {
    seedPreviousMonthPiutang();
    mount();
    await clickNav('Piutang');

    expect(tabText()).toContain('Belum Lunas dari Bulan Lain');
    expect(tabText()).toContain('Siti');

    await openSettleChoice();
    const options = Array.from(container.querySelectorAll('button.settle-option'));
    expect(options, 'harus ada dua pilihan bulan').toHaveLength(2);
    expect(options[0]!.textContent).toContain('Masuk');
    expect(options[1]!.textContent).toContain('Pulihkan di');
  });

  it('pelunasan "masuk bulan ini" jadi pemasukan, bulan asal tetap mencatat keluar', async () => {
    const prevKey = seedPreviousMonthPiutang();
    mount();
    await clickNav('Piutang');
    await openSettleChoice();
    await clickSelector('button.settle-option');

    // Bulan asal: lunas, TAPI pengeluarannya tetap ada — uangnya memang keluar
    // di bulan itu.
    const prev = readMonth(prevKey);
    expect(prev.piutang[0]!.status).toBe('Lunas');
    expect(prev.expenses).toHaveLength(1);

    // Bulan ini: bertambah 750.000 lewat entry pemasukan (bukan dobel).
    expect(balance()).toBe('Rp 5.900.000');
    await clickNav('Pemasukan');
    expect(tabText()).toContain('Pelunasan piutang: Siti');
  });

  it('pelunasan "pulihkan di bulan asal" menghapus pengeluarannya di sana', async () => {
    const prevKey = seedPreviousMonthPiutang();
    mount();
    await clickNav('Piutang');
    await openSettleChoice();
    await click(container.querySelectorAll('button.settle-option')[1], 'pilihan pulihkan');

    const prev = readMonth(prevKey);
    expect(prev.piutang[0]!.status).toBe('Lunas');
    expect(prev.expenses).toHaveLength(0);

    // Saldo bulan ini tidak ikut berubah.
    expect(balance()).toBe('Rp 5.150.000');
    expect(tabText()).not.toContain('Belum Lunas dari Bulan Lain');
  });

  it('tren bulanan menampilkan tiap bulan yang punya data', async () => {
    seedPreviousMonthPiutang();
    mount();
    await clickNav('Ringkasan');
    const rows = container.querySelectorAll('.trend-row');
    expect(rows).toHaveLength(2);
    // Urut kronologis: bulan lalu dulu, bulan ini di bawahnya.
    expect(rows[1]!.classList.contains('trend-row-active')).toBe(true);
  });

  it('setiap tombol ikon punya nama yang bisa dibaca screen reader', async () => {
    mount();
    for (const tab of TABS) {
      await clickNav(tab);
      for (const btn of container.querySelectorAll('button.btn-icon')) {
        expect(
          btn.getAttribute('aria-label'),
          `tombol ikon tanpa aria-label di tab ${tab}`,
        ).toBeTruthy();
      }
    }
  });
});

/**
 * Alur lengkap lewat UI.
 *
 * Test di lib/ menjaga kebenaran hitungan pada data, tapi tidak menyentuh
 * jalur yang paling sering rusak saat refactor: form mengisi state yang benar,
 * mutasi tersambung ke tombol yang benar, dan angka hasilnya sampai ke layar.
 */
describe('alur lewat UI', () => {
  it('tambah pengeluaran: nominal diformat saat diketik, saldo langsung turun', async () => {
    mount();
    await clickNav('Pengeluaran');
    await clickText('Tambah');

    setField('Deskripsi', 'Bensin');
    const jumlah = field('Jumlah (Rp)') as HTMLInputElement;
    setValue(jumlah, '75000');
    // MoneyInput menampilkan pemisah ribuan, bukan angka mentah.
    expect(jumlah.value).toBe('75.000');

    await clickText('Simpan');

    expect(tabText()).toContain('Bensin');
    expect(balance()).toBe('Rp 5.075.000');
    // Yang tersimpan tetap angka polos, bukan string berpemisah.
    expect(readMonth(monthKey(new Date())).expenses).toHaveLength(4);
  });

  it('edit pengeluaran mengubah saldo sesuai selisihnya', async () => {
    mount();
    await clickNav('Pengeluaran');
    await clickSelector('button[aria-label="Edit pengeluaran"]');

    setField('Jumlah (Rp)', '150000');
    await clickText('Simpan');

    // Makan siang 50.000 jadi 150.000, saldo turun 100.000.
    expect(balance()).toBe('Rp 5.050.000');
  });

  it('rencana yang dicentang jadi pengeluaran aktual', async () => {
    mount();
    await clickNav('Rencana');
    await clickSelector('button[role="checkbox"]');

    expect(balance()).toBe('Rp 4.850.000');
    await clickNav('Pengeluaran');
    expect(tabText()).toContain('Listrik');
    expect(tabText()).toContain('rencana');
  });

  it('filter menyaring baris tanpa mengubah data', async () => {
    mount();
    await clickNav('Pengeluaran');
    const search = container.querySelector<HTMLInputElement>('.filter-search input')!;
    setValue(search, 'makan');

    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.querySelector('.filter-count')!.textContent).toContain('1');
    // Saldo dihitung dari seluruh data, bukan dari baris yang tampil.
    expect(balance()).toBe('Rp 5.150.000');

    setValue(search, 'zzz');
    expect(tabText()).toContain('Tidak ada transaksi yang cocok');
    await clickText('Hapus Filter');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('navigasi bulan tidak mencampur data antar bulan', async () => {
    mount();
    const prevKey = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));

    await clickSelector('button[aria-label="Bulan sebelumnya"]');
    expect(balance()).toBe('Rp 0');

    await clickNav('Pengeluaran');
    await clickText('Tambah');
    setField('Deskripsi', 'Belanja bulan lalu');
    setField('Jumlah (Rp)', '20000');
    await clickText('Simpan');
    expect(balance()).toBe('−Rp 20.000');

    await clickSelector('button[aria-label="Bulan berikutnya"]');

    // Bulan ini utuh, dan entry bulan lalu tidak bocor ke sini.
    expect(balance()).toBe('Rp 5.150.000');
    expect(tabText()).not.toContain('Belanja bulan lalu');
    expect(readMonth(prevKey).expenses).toHaveLength(1);
    expect(readMonth(monthKey(new Date())).expenses).toHaveLength(3);
  });

  it('export lalu import mengembalikan data ke keadaan semula', async () => {
    mount();
    await clickNav('Data');
    await clickText('Generate');
    const backup = container.querySelector('.export-area')!.textContent!;
    expect(backup).toContain('finance_');

    // Ubah sesuatu supaya import benar-benar terbukti menimpa.
    await clickNav('Pengeluaran');
    await clickText('Tambah');
    setField('Deskripsi', 'Entry sementara');
    setField('Jumlah (Rp)', '11000');
    await clickText('Simpan');
    expect(balance()).toBe('Rp 5.139.000');

    await clickNav('Data');
    setValue(container.querySelector('.import-area')!, backup);
    await clickText('Import &');
    await confirmDialog();

    expect(balance()).toBe('Rp 5.150.000');
    await clickNav('Pengeluaran');
    expect(tabText()).not.toContain('Entry sementara');
  });

  it('hapus data bulan ini mengosongkan bulan aktif saja', async () => {
    seedPreviousMonthPiutang();
    mount();
    await clickNav('Data');
    await clickText('Hapus Bulan Ini');
    await confirmDialog();

    expect(balance()).toBe('Rp 0');
    // Bulan lain tidak ikut terhapus.
    expect(
      readMonth(monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1))).piutang,
    ).toHaveLength(1);
  });
});
