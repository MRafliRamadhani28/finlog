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
        { id: 3, date: '2026-07-02', category: 'Bonus', description: 'THR', amount: 1_000_000, note: '' },
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

beforeEach(() => {
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

function clickNav(label: string): void {
  const btn = Array.from(container.querySelectorAll('button.nav-item')).find(
    (b) => b.textContent?.trim() === label,
  );
  expect(btn, `tab "${label}" tidak ditemukan`).toBeTruthy();
  act(() => {
    (btn as HTMLButtonElement).click();
  });
}

describe('render app', () => {
  it('panel saldo menampilkan angka yang benar', () => {
    mount();
    // 5.000.000 + 1.000.000 − (50.000 + 500.000 + 300.000) = 5.150.000
    const amounts = Array.from(container.querySelectorAll('.bal-amount')).map((el) =>
      el.textContent?.trim(),
    );
    expect(amounts[0]).toBe('Rp 5.150.000');
    expect(amounts[1]).toBe('Rp 300.000');
  });

  it('semua tab bisa dibuka tanpa crash dan menampilkan isi', () => {
    mount();
    for (const tab of TABS) {
      clickNav(tab);
      const content = container.querySelector('.content');
      expect(content, `tab ${tab} kosong`).toBeTruthy();
      expect(content!.textContent!.length, `tab ${tab} tidak punya isi`).toBeGreaterThan(20);
    }
  });

  it('tidak ada emoji yang tersisa sebagai ikon antarmuka', () => {
    mount();
    for (const tab of TABS) {
      clickNav(tab);
      const text = container.querySelector('.content')!.textContent ?? '';
      // Emoji milik user (wishlist) dikecualikan: dia berada di .wl-emoji-wrap.
      const uiText = text.replace(/💻|🌟/g, '');
      expect(uiText, `tab ${tab} masih memakai emoji sebagai ikon`).not.toMatch(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
      );
    }
  });

  it('setiap tombol ikon punya nama yang bisa dibaca screen reader', () => {
    mount();
    for (const tab of TABS) {
      clickNav(tab);
      for (const btn of container.querySelectorAll('button.btn-icon')) {
        expect(
          btn.getAttribute('aria-label'),
          `tombol ikon tanpa aria-label di tab ${tab}`,
        ).toBeTruthy();
      }
    }
  });
});
