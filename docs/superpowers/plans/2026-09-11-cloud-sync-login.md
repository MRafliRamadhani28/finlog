# Login Tersembunyi + Sinkron Cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Klik logo "finlog" membuka login ke Neon; setelah login, data localStorage di-push otomatis ke cloud dan ditarik saat login di device lain; klik logo lagi memunculkan toast konfirmasi logout.

**Architecture:** localStorage tetap sumber utama. `storage.ts` memanggil satu listener di setiap tulis `finance_*`; `lib/cloud.ts` menangkapnya, men-debounce 3 detik, lalu POST seluruh `exportAll()` ke Neon Data API (PostgREST) dengan JWT dari Neon Auth (Better Auth). Klien auth `better-auth/client` dimuat dinamis, jadi bundle awal tidak bertambah.

**Tech Stack:** React 19, TypeScript strict, Vite 7, Vitest 4 (node + jsdom), `better-auth@1.6.23`, Neon Auth + Neon Data API.

**Spec:** `docs/superpowers/specs/2026-09-11-cloud-sync-login-design.md`

## Global Constraints

- Skema localStorage beku: key `finance_YYYY_MM`, `finance_accounts`, `finance_wishlist`, `keuangan_bal_hidden`, `keuangan_tutorial_done` tidak diubah bentuk maupun namanya. Satu-satunya key baru: `finlog_cloud` → `{ "email": string, "dirty": boolean }`.
- Semua akses localStorage lewat `src/lib/storage.ts`.
- Dependency baru hanya `better-auth`, dipin persis `1.6.23` (`--save-exact`). Tidak ada `@neondatabase/neon-js`.
- `better-auth/client` hanya boleh dimuat lewat `import()` dinamis di `src/lib/cloud.ts`.
- Tidak ada komentar baru di kode (aturan user). Komentar lama dibiarkan.
- TypeScript: tanpa `any`, return type eksplisit (termasuk komponen `: ReactNode`), `import type` untuk tipe.
- CSS berbasis class di `src/styles/system.css`, bukan inline style.
- Toast lewat `src/lib/toast.ts`, modal lewat `components/Modal.tsx`.
- Teks UI bahasa Indonesia.
- Env: `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL`, disimpan di `.env.local` (tidak di-commit).
- Jangan `git commit` kecuali user memintanya. Setiap task diakhiri checkpoint (test + typecheck hijau), bukan commit.

## File Structure

| File | Status | Tanggung jawab |
|---|---|---|
| `src/lib/storage.ts` | ubah | Listener perubahan `finance_*`, baca/tulis `finlog_cloud` |
| `src/lib/cloud.ts` | baru | Logika murni keputusan login, klien auth dinamis, JWT, pull/push, penjadwal sync |
| `src/vite-env.d.ts` | baru | Tipe `import.meta.env` untuk dua env Neon |
| `src/lib/cloud.test.ts` | baru | Test penjadwal sync (jsdom, klien auth + `fetch` di-mock) |
| `src/lib/logic.test.ts` | ubah | Test `decideOnLogin`, `sameSnapshot` |
| `src/lib/toast.ts` | ubah | Tambah `toast.info` |
| `src/components/Header.tsx` | ubah | `<h1>` jadi tombol `.brand-btn`, prop `onBrandClick` |
| `src/components/LoginModal.tsx` | baru | Form login + pilihan konflik |
| `src/App.tsx` | ubah | State `cloudEmail`, resume sync saat mount, klik logo, logout |
| `src/styles/system.css` | ubah | `.brand-btn` |
| `src/App.smoke.test.tsx` | ubah | Test listener storage + alur logo |
| `.gitignore` | ubah | `*.local` |
| `.env.local` | baru, tidak di-commit | URL Neon |
| `CLAUDE.md` | ubah (lokal, di-gitignore) | Dokumentasi sync |

---

### Task 1: Listener perubahan dan state cloud di `storage.ts`

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/App.smoke.test.tsx`

**Interfaces:**
- Consumes: —
- Produces:
  - `KEYS.cloud: 'finlog_cloud'`
  - `interface CloudState { email: string; dirty: boolean }`
  - `onFinanceChange(cb: (() => void) | null): void`
  - `loadCloudState(): CloudState | null`
  - `saveCloudState(s: CloudState | null): void`

- [ ] **Step 0: Catat baseline bundle**

Run: `npm run build`, lalu `for f in dist/assets/index-*.js; do echo "$f $(gzip -c $f | wc -c)"; done`
Catat angka gzip `index-*.js` untuk dibandingkan di Task 5.

- [ ] **Step 1: Tulis test yang gagal**

Di `src/App.smoke.test.tsx`, ubah import di baris 2 dan 6:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
```

```tsx
import {
  KEYS,
  defaultMonthData,
  deleteAllData,
  exportAll,
  importAll,
  loadCloudState,
  monthKey,
  onFinanceChange,
  removeMonth,
  saveCloudState,
  saveMonth,
  setFlag,
} from './lib/storage';
```

Tambahkan di akhir file:

```tsx
describe('storage untuk sync', () => {
  afterEach(() => onFinanceChange(null));

  it('listener terpanggil untuk setiap tulis data finance', () => {
    const cb = vi.fn();
    onFinanceChange(cb);
    saveMonth('finance_2026_01', defaultMonthData());
    importAll({ finance_2026_02: defaultMonthData() }, ['finance_2026_02']);
    removeMonth('finance_2026_01');
    deleteAllData();
    expect(cb).toHaveBeenCalledTimes(4);
  });

  it('listener tidak terpanggil untuk flag perangkat dan state cloud', () => {
    const cb = vi.fn();
    onFinanceChange(cb);
    setFlag(KEYS.balHidden, true);
    saveCloudState({ email: 'a@b.c', dirty: true });
    saveCloudState(null);
    expect(cb).not.toHaveBeenCalled();
  });

  it('state cloud tidak ikut export dan tidak terhapus oleh hapus semua', () => {
    saveCloudState({ email: 'a@b.c', dirty: false });
    expect(Object.keys(exportAll())).not.toContain(KEYS.cloud);
    deleteAllData();
    expect(loadCloudState()).toEqual({ email: 'a@b.c', dirty: false });
  });

  it('state cloud yang korup dibaca sebagai belum login', () => {
    localStorage.setItem(KEYS.cloud, '{"dirty":true}');
    expect(loadCloudState()).toBeNull();
    localStorage.setItem(KEYS.cloud, 'bukan json');
    expect(loadCloudState()).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/App.smoke.test.tsx -t "storage untuk sync"`
Expected: FAIL, `onFinanceChange is not a function` (atau sejenisnya untuk `saveCloudState`/`loadCloudState`).

- [ ] **Step 3: Implementasi di `src/lib/storage.ts`**

Tambahkan `cloud` ke `KEYS`:

```ts
export const KEYS = {
  accounts: 'finance_accounts',
  wishlist: 'finance_wishlist',
  balHidden: 'keuangan_bal_hidden',
  tutorialDone: 'keuangan_tutorial_done',
  cloud: 'finlog_cloud',
} as const;
```

Tepat sebelum `function writeJSON`, tambahkan:

```ts
let financeListener: (() => void) | null = null;

export function onFinanceChange(cb: (() => void) | null): void {
  financeListener = cb;
}
```

Di `writeJSON`, tambahkan satu baris setelah blok `try/catch` (blok `catch` beserta komentarnya tidak diubah):

```ts
function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Kuota penuh / storage diblokir. Biarkan pemanggil yang memberi tahu user.
    console.error('Gagal menyimpan ke localStorage:', e);
    throw e;
  }
  if (isFinanceKey(key)) financeListener?.();
}
```

Ganti `removeMonth` dan `deleteAllData`:

```ts
export function removeMonth(key: string): void {
  localStorage.removeItem(key);
  financeListener?.();
}
```

```ts
export function deleteAllData(): void {
  for (const k of allFinanceKeys()) localStorage.removeItem(k);
  financeListener?.();
}
```

Tambahkan di akhir file:

```ts
export interface CloudState {
  email: string;
  dirty: boolean;
}

export function loadCloudState(): CloudState | null {
  const v = readJSON<Partial<CloudState> | null>(KEYS.cloud, null);
  return v && typeof v.email === 'string' ? { email: v.email, dirty: v.dirty === true } : null;
}

export function saveCloudState(s: CloudState | null): void {
  try {
    if (s) localStorage.setItem(KEYS.cloud, JSON.stringify(s));
    else localStorage.removeItem(KEYS.cloud);
  } catch (e) {
    console.error('Gagal menyimpan status cloud:', e);
  }
}
```

- [ ] **Step 4: Jalankan, pastikan lolos**

Run: `npx vitest run src/App.smoke.test.tsx -t "storage untuk sync"`
Expected: PASS, 4 test.

- [ ] **Step 5: Checkpoint**

Run: `npm test && npm run typecheck`
Expected: semua hijau. Tidak ada test lama yang rusak.

---

### Task 2: Logika murni keputusan login di `cloud.ts`

**Files:**
- Create: `src/lib/cloud.ts`
- Test: `src/lib/logic.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type Snapshot = Record<string, unknown>`
  - `type LoginDecision = 'push' | 'pull' | 'ask' | 'same'`
  - `sameSnapshot(a: Snapshot, b: Snapshot): boolean`
  - `decideOnLogin(local: Snapshot, cloud: Snapshot | null): LoginDecision`

- [ ] **Step 1: Tulis test yang gagal**

Di `src/lib/logic.test.ts`, tambahkan import setelah import `./crossMonth`:

```ts
import { decideOnLogin, sameSnapshot } from './cloud';
```

Tambahkan di akhir file:

```ts
describe('sinkron cloud', () => {
  const data = { finance_2026_01: { salary: 1, income: [{ id: 1, amount: 2 }] } };

  it('decideOnLogin mengikuti tabel keputusan spec', () => {
    expect(decideOnLogin({}, null)).toBe('same');
    expect(decideOnLogin({}, {})).toBe('same');
    expect(decideOnLogin(data, null)).toBe('push');
    expect(decideOnLogin(data, {})).toBe('push');
    expect(decideOnLogin({}, data)).toBe('pull');
    expect(decideOnLogin(data, structuredClone(data))).toBe('same');
    expect(decideOnLogin(data, { finance_2026_01: { salary: 9 } })).toBe('ask');
  });

  it('sameSnapshot mengabaikan urutan key object tapi tidak urutan array', () => {
    expect(sameSnapshot({ x: { a: 1, b: { c: 2, d: 3 } } }, { x: { b: { d: 3, c: 2 }, a: 1 } })).toBe(
      true,
    );
    expect(sameSnapshot({ x: [1, 2] }, { x: [2, 1] })).toBe(false);
    expect(sameSnapshot({ x: 1 }, { x: 1, y: 2 })).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/logic.test.ts -t "sinkron cloud"`
Expected: FAIL, modul `./cloud` tidak ditemukan.

- [ ] **Step 3: Buat `src/lib/cloud.ts`**

```ts
export type Snapshot = Record<string, unknown>;
export type LoginDecision = 'push' | 'pull' | 'ask' | 'same';

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, canonical(o[k])]),
    );
  }
  return v;
}

export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function decideOnLogin(local: Snapshot, cloud: Snapshot | null): LoginDecision {
  const hasLocal = Object.keys(local).length > 0;
  if (!cloud || Object.keys(cloud).length === 0) return hasLocal ? 'push' : 'same';
  if (!hasLocal) return 'pull';
  return sameSnapshot(local, cloud) ? 'same' : 'ask';
}
```

`local` selalu hasil `exportAll()`, yang hanya berisi key `finance_*`, jadi "kosong" di sini sama dengan "tidak ada key `finance_*`" di spec.

- [ ] **Step 4: Jalankan, pastikan lolos**

Run: `npx vitest run src/lib/logic.test.ts -t "sinkron cloud"`
Expected: PASS, 2 test.

- [ ] **Step 5: Checkpoint**

Run: `npm test && npm run typecheck`
Expected: semua hijau.

---

### Task 3: Klien Neon dan penjadwal sync

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `src/vite-env.d.ts`
- Modify: `src/lib/cloud.ts`
- Create: `src/lib/cloud.test.ts`

**Interfaces:**
- Consumes: dari Task 1 `onFinanceChange`, `loadCloudState`, `saveCloudState`, `exportAll`, `importAll`, `importableKeys`, `deleteAllData`; dari Task 2 `Snapshot`.
- Produces:
  - `class CloudError extends Error { readonly status: number }` (0 = jaringan/chunk gagal)
  - `cloudEnabled(): boolean`
  - `signIn(email: string, password: string): Promise<void>` (lempar `CloudError`)
  - `signOut(): Promise<void>` (tidak pernah melempar)
  - `pull(): Promise<{ data: Snapshot; updatedAt: string } | null>` (lempar `CloudError`)
  - `push(): Promise<void>` (lempar `CloudError`)
  - `replaceLocal(cloud: Snapshot): void`
  - `startSync(onExpired: () => void): void`
  - `stopSync(): void`
  - `flush(): Promise<void>` (tidak pernah melempar)
  - `beginSession(email: string, onExpired: () => void): void`
  - `logout(): Promise<void>`

- [ ] **Step 1: Pasang dependency**

Run: `npm install better-auth@1.6.23 --save-exact`
Expected: `package.json` berisi `"better-auth": "1.6.23"` tanpa `^`.

- [ ] **Step 2: Buat `src/vite-env.d.ts`**

```ts
interface ImportMetaEnv {
  readonly VITE_NEON_AUTH_URL?: string;
  readonly VITE_NEON_DATA_API_URL?: string;
}
```

- [ ] **Step 3: Tulis test yang gagal**

Buat `src/lib/cloud.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS, defaultMonthData, loadCloudState, saveMonth } from './storage';
import { beginSession, startSync, stopSync } from './cloud';

const auth = vi.hoisted(() => ({
  $fetch: vi.fn(),
  signInEmail: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('better-auth/client', () => ({
  createAuthClient: () => ({
    $fetch: auth.$fetch,
    signIn: { email: auth.signInEmail },
    signOut: auth.signOut,
  }),
}));

const fetchMock = vi.fn<typeof fetch>();
const onExpired = vi.fn();

const fakeJwt = (): string =>
  `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.s`;

const change = (): void =>
  saveMonth('finance_2026_01', { ...defaultMonthData(), salary: Math.random() });

const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(50);
};

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.test');
  vi.stubEnv('VITE_NEON_DATA_API_URL', 'https://data.test');
  auth.$fetch.mockResolvedValue({ data: { token: fakeJwt() }, error: null });
  fetchMock.mockReset();
  onExpired.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  stopSync();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('penjadwal sync', () => {
  it('perubahan di-push setelah 3 detik lalu dirty dibersihkan', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    beginSession('a@b.c', onExpired);
    change();
    expect(loadCloudState()).toEqual({ email: 'a@b.c', dirty: true });
    await vi.advanceTimersByTimeAsync(2900);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    await vi.waitFor(() => expect(loadCloudState()?.dirty).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://data.test/finlog_snapshot');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as { data: Record<string, unknown> };
    expect(body.data).toHaveProperty('finance_2026_01');
  });

  it('push gagal karena jaringan: dirty tetap true, sesi tidak berakhir', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    beginSession('a@b.c', onExpired);
    change();
    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await settle();
    expect(loadCloudState()).toEqual({ email: 'a@b.c', dirty: true });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('401 dari Data API: state cloud dihapus dan onExpired dipanggil', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    beginSession('a@b.c', onExpired);
    change();
    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
    expect(loadCloudState()).toBeNull();
  });

  it('perubahan saat push berjalan tetap ter-push di putaran berikutnya', async () => {
    let release: (r: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            release = r;
          }),
      )
      .mockResolvedValue(new Response(null, { status: 201 }));
    beginSession('a@b.c', onExpired);
    change();
    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    change();
    release(new Response(null, { status: 201 }));
    await settle();
    expect(loadCloudState()?.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() => expect(loadCloudState()?.dirty).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('startup dengan dirty = true langsung push tanpa menunggu perubahan', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    localStorage.setItem(KEYS.cloud, JSON.stringify({ email: 'a@b.c', dirty: true }));
    startSync(onExpired);
    await vi.waitFor(() => expect(loadCloudState()?.dirty).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('setelah stopSync, perubahan tidak lagi di-push', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    beginSession('a@b.c', onExpired);
    stopSync();
    change();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/cloud.test.ts`
Expected: FAIL, `beginSession`/`startSync`/`stopSync` tidak diekspor dari `./cloud`.

- [ ] **Step 5: Lengkapi `src/lib/cloud.ts`**

Ganti seluruh isi file dengan:

```ts
import {
  deleteAllData,
  exportAll,
  importAll,
  importableKeys,
  loadCloudState,
  onFinanceChange,
  saveCloudState,
} from './storage';

export type Snapshot = Record<string, unknown>;
export type LoginDecision = 'push' | 'pull' | 'ask' | 'same';

type AuthClient = ReturnType<typeof import('better-auth/client').createAuthClient>;

export class CloudError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`cloud ${status}`);
    this.status = status;
  }
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, canonical(o[k])]),
    );
  }
  return v;
}

export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function decideOnLogin(local: Snapshot, cloud: Snapshot | null): LoginDecision {
  const hasLocal = Object.keys(local).length > 0;
  if (!cloud || Object.keys(cloud).length === 0) return hasLocal ? 'push' : 'same';
  if (!hasLocal) return 'pull';
  return sameSnapshot(local, cloud) ? 'same' : 'ask';
}

const authUrl = (): string => import.meta.env.VITE_NEON_AUTH_URL ?? '';
const dataUrl = (): string => (import.meta.env.VITE_NEON_DATA_API_URL ?? '').replace(/\/$/, '');

export function cloudEnabled(): boolean {
  return authUrl() !== '' && dataUrl() !== '';
}

let clientPromise: Promise<AuthClient> | null = null;

function client(): Promise<AuthClient> {
  clientPromise ??= import('better-auth/client')
    .then((m) => m.createAuthClient({ baseURL: authUrl() }))
    .catch((e: unknown) => {
      clientPromise = null;
      throw e;
    });
  return clientPromise;
}

let jwt: { token: string; exp: number } | null = null;

function jwtExp(token: string): number {
  const part = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(atob(part)) as { exp?: number };
  return (payload.exp ?? 0) * 1000;
}

async function getJwt(): Promise<string> {
  if (jwt && jwt.exp - 60_000 > Date.now()) return jwt.token;
  let token: string | undefined;
  let status = 0;
  try {
    const c = await client();
    const res = await c.$fetch<{ token: string }>('/token', { method: 'GET' });
    token = res.data?.token;
    status = res.error?.status ?? 0;
  } catch {
    throw new CloudError(0);
  }
  if (!token) throw new CloudError(status || 401);
  jwt = { token, exp: jwtExp(token) };
  return token;
}

async function api(
  path: string,
  init: { method: 'GET' | 'POST'; body?: string; prefer?: string },
): Promise<Response> {
  const token = await getJwt();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (init.prefer) headers['Prefer'] = init.prefer;
  let res: Response;
  try {
    res = await fetch(dataUrl() + path, { method: init.method, headers, body: init.body });
  } catch {
    throw new CloudError(0);
  }
  if (!res.ok) throw new CloudError(res.status);
  return res;
}

export async function signIn(email: string, password: string): Promise<void> {
  let status: number | undefined;
  try {
    const c = await client();
    const res = await c.signIn.email({ email, password });
    status = res.error ? res.error.status : undefined;
  } catch {
    throw new CloudError(0);
  }
  if (status !== undefined) throw new CloudError(status);
  jwt = null;
}

export async function signOut(): Promise<void> {
  jwt = null;
  try {
    const c = await client();
    await c.signOut();
  } catch {
    return;
  }
}

export async function pull(): Promise<{ data: Snapshot; updatedAt: string } | null> {
  const res = await api('/finlog_snapshot?select=data,updated_at', { method: 'GET' });
  const rows = (await res.json()) as { data: Snapshot; updated_at: string }[];
  const row = rows[0];
  return row ? { data: row.data, updatedAt: row.updated_at } : null;
}

export async function push(): Promise<void> {
  await api('/finlog_snapshot', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({ data: exportAll(), updated_at: new Date().toISOString() }),
  });
}

export function replaceLocal(cloud: Snapshot): void {
  deleteAllData();
  importAll(cloud, importableKeys(cloud));
}

const PUSH_DELAY = 3000;
let timer: ReturnType<typeof setTimeout> | null = null;
let changes = 0;
let inFlight: Promise<void> | null = null;
let again = false;
let expiredHandler: (() => void) | null = null;

function markDirty(): void {
  changes++;
  const s = loadCloudState();
  if (s && !s.dirty) saveCloudState({ ...s, dirty: true });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), PUSH_DELAY);
}

function expire(): void {
  const handler = expiredHandler;
  stopSync();
  saveCloudState(null);
  jwt = null;
  handler?.();
}

export function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (inFlight) {
    again = true;
    return inFlight;
  }
  if (!loadCloudState()?.dirty) return Promise.resolve();
  const seen = changes;
  inFlight = push()
    .then(
      () => {
        const cur = loadCloudState();
        if (cur && changes === seen) saveCloudState({ ...cur, dirty: false });
      },
      (e: unknown) => {
        if (e instanceof CloudError && e.status === 401) expire();
      },
    )
    .finally(() => {
      inFlight = null;
      if (again) {
        again = false;
        void flush();
      }
    });
  return inFlight;
}

const onOnline = (): void => {
  void flush();
};

export function startSync(onExpired: () => void): void {
  expiredHandler = onExpired;
  onFinanceChange(markDirty);
  window.addEventListener('online', onOnline);
  void flush();
}

export function stopSync(): void {
  onFinanceChange(null);
  window.removeEventListener('online', onOnline);
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  expiredHandler = null;
}

export function beginSession(email: string, onExpired: () => void): void {
  saveCloudState({ email, dirty: false });
  startSync(onExpired);
}

export async function logout(): Promise<void> {
  stopSync();
  await flush();
  await signOut();
  saveCloudState(null);
}
```

Hal yang disengaja dan jangan diubah:
- `push()` membaca `exportAll()` saat request dikirim, bukan saat perubahan terjadi.
- `changes === seen` mencegah `dirty` dibersihkan kalau ada perubahan baru selama push berjalan.
- `replaceLocal` dipanggil sebelum `beginSession`, jadi listener belum terpasang dan tidak ada push yang menimpa cloud sebelum user memilih.

- [ ] **Step 6: Jalankan, pastikan lolos**

Run: `npx vitest run src/lib/cloud.test.ts src/lib/logic.test.ts`
Expected: PASS semua. Kalau test "saat push berjalan" gagal karena `fetchMock` terpanggil 1 kali, periksa kondisi `changes === seen` di `flush`.

- [ ] **Step 7: Buktikan test benar-benar menjaga logika**

Ubah sementara `if (cur && changes === seen)` menjadi `if (cur)` di `flush`, lalu jalankan `npx vitest run src/lib/cloud.test.ts`.
Expected: test "perubahan saat push berjalan tetap ter-push di putaran berikutnya" FAIL. Kembalikan baris itu, jalankan ulang, dan pastikan semua PASS.

- [ ] **Step 8: Checkpoint**

Run: `npm test && npm run typecheck`
Expected: semua hijau.

---

### Task 4: UI — logo, `LoginModal`, toast logout

**Files:**
- Modify: `src/lib/toast.ts`
- Modify: `src/components/Header.tsx`
- Create: `src/components/LoginModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/system.css`
- Test: `src/App.smoke.test.tsx`

**Interfaces:**
- Consumes: dari Task 1 `loadCloudState`, `saveCloudState`, `exportAll`; dari Task 3 `CloudError`, `cloudEnabled`, `decideOnLogin`, `pull`, `push`, `replaceLocal`, `signIn`, `signOut`, `beginSession`, `startSync`, `stopSync`, `logout`, `LoginDecision`, `Snapshot`.
- Produces:
  - `toast.info(message: string, options?: ToastOptions): void`
  - `Header` prop baru `onBrandClick: () => void`
  - `LoginModal({ onClose, onLoggedIn }: { onClose: () => void; onLoggedIn: (email: string, replacedLocal: boolean) => void }): ReactNode`

- [ ] **Step 1: Tulis test yang gagal**

Di `src/App.smoke.test.tsx`, tambahkan import:

```tsx
import { toast } from './lib/toast';
```

Tambahkan di akhir file:

```tsx
describe('login tersembunyi', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const logo = (): Element | null => container.querySelector('.header h1 button');
  const dialog = (): Element | null => container.querySelector('.modal[role="dialog"]');
  const stubCloudEnv = (): void => {
    vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.test');
    vi.stubEnv('VITE_NEON_DATA_API_URL', 'https://data.test');
  };

  it('logo tetap bertuliskan finlog', () => {
    mount();
    expect(logo()?.textContent).toBe('finlog');
  });

  it('tanpa env, klik logo tidak membuka apa pun', async () => {
    vi.stubEnv('VITE_NEON_AUTH_URL', '');
    vi.stubEnv('VITE_NEON_DATA_API_URL', '');
    mount();
    await click(logo(), 'logo');
    expect(dialog()).toBeNull();
  });

  it('belum login, klik logo membuka form login', async () => {
    stubCloudEnv();
    mount();
    await click(logo(), 'logo');
    expect(dialog()?.textContent).toContain('Masuk');
    expect(field('Email')).toBeTruthy();
    expect(field('Password')).toBeTruthy();
  });

  it('batal menutup form login tanpa menulis state cloud', async () => {
    stubCloudEnv();
    mount();
    await click(logo(), 'logo');
    await click(container.querySelector('.modal[role="dialog"] .btn-ghost'), 'tombol Batal');
    expect(dialog()).toBeNull();
    expect(loadCloudState()).toBeNull();
  });

  it('sudah login, klik logo memunculkan toast konfirmasi logout', async () => {
    stubCloudEnv();
    saveCloudState({ email: 'a@b.c', dirty: false });
    const info = vi.spyOn(toast, 'info').mockImplementation(() => {});
    mount();
    await click(logo(), 'logo');
    expect(info).toHaveBeenCalledWith(
      'Keluar dari akun a@b.c?',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Logout' }) }),
    );
    expect(dialog()).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/App.smoke.test.tsx -t "login tersembunyi"`
Expected: FAIL, `logo tidak ditemukan` (belum ada `button` di `h1`).

- [ ] **Step 3: `toast.info` di `src/lib/toast.ts`**

Tambah `displayDuration` ke `ToastOptions`, lalu teruskan ke goey-toast sebagai `timing`. Tanpa ini goey-toast menciutkan toast jadi pil dan membuang tombol aksinya sebelum `duration` habis (terbukti di uji browser):

```ts
export interface ToastOptions {
  action?: ToastAction;
  duration?: number;
  displayDuration?: number;
}

function show(kind: 'success' | 'error' | 'info', message: string, options?: ToastOptions): void {
  const { displayDuration, ...rest } = options ?? {};
  const goeyOptions = displayDuration ? { ...rest, timing: { displayDuration } } : rest;
  void load().then(
    (m) => m.gooeyToast[kind](message, goeyOptions as GooeyToastOptions),
```

```ts
export const toast = {
  success: (message: string, options?: ToastOptions): void => show('success', message, options),
  error: (message: string, options?: ToastOptions): void => show('error', message, options),
  info: (message: string, options?: ToastOptions): void => show('info', message, options),
};
```

- [ ] **Step 4: Tombol logo di `src/components/Header.tsx`**

```tsx
interface HeaderProps {
  onToggleSidebar: () => void;
  onStartTutorial: () => void;
  onBrandClick: () => void;
}

export function Header({ onToggleSidebar, onStartTutorial, onBrandClick }: HeaderProps): ReactNode {
```

Ganti `<h1>finlog</h1>` dengan:

```tsx
        <h1>
          <button type="button" className="brand-btn" onClick={onBrandClick}>
            finlog
          </button>
        </h1>
```

Di `src/styles/system.css`, tepat setelah blok `.header h1 { ... }` (sekitar baris 237-241):

```css
.brand-btn {
  font: inherit;
  letter-spacing: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: default;
}
```

`cursor: default` disengaja supaya tidak ada petunjuk bahwa logo bisa diklik. Outline fokus bawaan browser tidak dihapus.

- [ ] **Step 5: Buat `src/components/LoginModal.tsx`**

```tsx
import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { Field, Modal } from './Modal';
import {
  CloudError,
  decideOnLogin,
  pull,
  push,
  replaceLocal,
  signIn,
  signOut,
  type LoginDecision,
  type Snapshot,
} from '../lib/cloud';
import { exportAll } from '../lib/storage';

interface LoginModalProps {
  onClose: () => void;
  onLoggedIn: (email: string, replacedLocal: boolean) => void;
}

type Stage = { kind: 'form' } | { kind: 'choose'; cloud: Snapshot; updatedAt: string };

const WRONG_CREDENTIALS = [400, 401, 403];
const SYNC_FAILED = 'Gagal menyinkronkan data cloud. Coba lagi.';

export function LoginModal({ onClose, onLoggedIn }: LoginModalProps): ReactNode {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'form' });

  const cancel = useCallback((): void => {
    if (busy) return;
    if (stage.kind === 'choose') void signOut();
    onClose();
  }, [busy, stage.kind, onClose]);

  const finish = async (decision: LoginDecision, cloud: Snapshot | null): Promise<void> => {
    if (decision === 'push') await push();
    if (decision === 'pull' && cloud) replaceLocal(cloud);
    onLoggedIn(email.trim(), decision === 'pull');
  };

  const fail = async (message: string): Promise<void> => {
    await signOut();
    setStage({ kind: 'form' });
    setError(message);
    setBusy(false);
  };

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof CloudError && WRONG_CREDENTIALS.includes(err.status)
          ? 'Email atau password salah.'
          : 'Tidak bisa terhubung ke server.',
      );
      setBusy(false);
      return;
    }
    try {
      const cloud = await pull();
      const decision = decideOnLogin(exportAll(), cloud?.data ?? null);
      if (decision === 'ask' && cloud) {
        setStage({ kind: 'choose', cloud: cloud.data, updatedAt: cloud.updatedAt });
        setBusy(false);
        return;
      }
      await finish(decision, cloud?.data ?? null);
    } catch {
      await fail(SYNC_FAILED);
    }
  };

  const choose = async (decision: 'push' | 'pull'): Promise<void> => {
    if (stage.kind !== 'choose') return;
    setBusy(true);
    try {
      await finish(decision, stage.cloud);
    } catch {
      await fail(SYNC_FAILED);
    }
  };

  if (stage.kind === 'choose') {
    return (
      <Modal
        open
        icon="warn"
        title="Data Berbeda"
        onClose={cancel}
        maxWidth={420}
        actions={
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void choose('push')}>
              Pakai data device ini
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void choose('pull')}>
              Pakai data cloud
            </button>
          </>
        }
      >
        <p className="modal-text">
          Data di device ini berbeda dengan data cloud (terakhir diperbarui{' '}
          {new Date(stage.updatedAt).toLocaleString('id-ID')}). Pilih yang dipakai; yang lain akan
          ditimpa.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      icon="lock"
      title="Masuk"
      onClose={cancel}
      maxWidth={380}
      actions={
        <>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancel}>
            Batal
          </button>
          <button type="submit" form="login-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Memproses…' : 'Masuk'}
          </button>
        </>
      }
    >
      <form id="login-form" onSubmit={(e) => void submit(e)}>
        <Field label="Email" full>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" full>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <p className="text-red" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
```

`cancel` wajib `useCallback`: `Modal` menjalankan efek fokus setiap kali `onClose` berganti identitas. Tanpa memo, setiap ketikan membuat fokus melompat dari Password ke Email.

- [ ] **Step 6: Wiring di `src/App.tsx`**

Tambahkan import:

```tsx
import { beginSession, cloudEnabled, logout, startSync, stopSync } from './lib/cloud';
import { toast } from './lib/toast';
import { LoginModal } from './components/LoginModal';
```

Ubah import storage:

```tsx
import { KEYS, getFlag, loadCloudState, monthKey, setFlag } from './lib/storage';
```

Di `Shell`, ubah destructuring `useApp` agar ikut mengambil `reloadAll`:

```tsx
  const { balHidden, data, currentDate, reloadAll } = useApp();
```

Tambahkan state dan handler setelah deklarasi `moreOpen`:

```tsx
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
```

Oper ke `Header`:

```tsx
        <Header
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onStartTutorial={() => setTutorialOpen(true)}
          onBrandClick={brandClick}
        />
```

Render modal tepat setelah `<TutorialOverlay ... />`:

```tsx
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLoggedIn={loggedIn} />}
```

- [ ] **Step 7: Jalankan, pastikan lolos**

Run: `npx vitest run src/App.smoke.test.tsx`
Expected: PASS semua, termasuk test lama (tab, emoji, alur UI).

- [ ] **Step 8: Checkpoint**

Run: `npm test && npm run typecheck`
Expected: semua hijau.

---

### Task 5: Env, dokumentasi, bundle, dan uji ke Neon asli

**Files:**
- Modify: `.gitignore`
- Create: `.env.local`
- Modify: `CLAUDE.md` (lokal, di-gitignore)

**Interfaces:**
- Consumes: semua task sebelumnya.
- Produces: fitur siap dipakai di dev dan terverifikasi ke Neon.

- [ ] **Step 1: `.gitignore` dan `.env.local`**

Tambahkan di akhir `.gitignore`:

```
# Env lokal
*.local
```

Buat `.env.local`:

```
VITE_NEON_AUTH_URL=https://ep-misty-hall-ay86z3wy.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth
VITE_NEON_DATA_API_URL=https://ep-misty-hall-ay86z3wy.apirest.c-5.us-east-2.aws.neon.tech/neondb/rest/v1
```

Run: `git status --short`
Expected: `.env.local` tidak muncul.

- [ ] **Step 2: Cek bundle**

Run: `npm run build`, lalu:

```bash
for f in dist/assets/index-*.js; do echo "$f $(gzip -c $f | wc -c)"; done
node -e "const m=require('./dist/asset-manifest.json');for(const[k,v]of Object.entries(m))if(v.isDynamicEntry)console.log(k,'->',v.file)"
```

Expected: gzip `index-*.js` naik paling banyak ~1 kB dibanding baseline Task 1 Step 0 (hanya kode `cloud.ts` + `LoginModal`). `better-auth` muncul sebagai dynamic entry di chunk terpisah.

- [ ] **Step 3: Bersihkan data spike di Neon (dikerjakan user)**

Minta user menjalankan di SQL Editor Neon:

```sql
DELETE FROM public.finlog_snapshot;
```

Tanpa ini, baris spike berisi key `finance_spike` akan tertarik ke localStorage saat login pertama.

- [ ] **Step 4: Dokumentasi di `CLAUDE.md`**

Tambahkan section setelah "Piutang lintas bulan dibaca, bukan dipindah" (bagian Model data):

```markdown
**Sinkron cloud (Neon) opsional, localStorage tetap sumber utama.** Login dibuka lewat klik logo "finlog" (tidak ada tombol yang terlihat). Setelah login, `storage.ts` memanggil listener `onFinanceChange` di setiap tulis `finance_*`, lalu `lib/cloud.ts` men-debounce 3 detik dan POST seluruh `exportAll()` ke tabel `finlog_snapshot` lewat Neon Data API. Pull hanya saat login, dan kalau dua sisi berbeda user yang memilih (`decideOnLogin`). Status login di key `finlog_cloud` (awalan bukan `finance_`, jadi tidak ikut export/import/hapus/sync). Env: `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL` di `.env.local`; tanpa env, klik logo tidak melakukan apa-apa. `better-auth/client` hanya boleh dimuat dinamis di `cloud.ts`. Batas yang diterima: last-write-wins seluruh blob. Spec: `docs/superpowers/specs/2026-09-11-cloud-sync-login-design.md`.
```

Di bagian perintah test, tambahkan `src/lib/cloud.test.ts` (jsdom, klien auth + `fetch` di-mock) ke daftar file test.

- [ ] **Step 5: Uji manual ke Neon asli**

Butuh password `test@finlog.id` dari user. Kalau user tidak mau membagikannya, user yang menjalankan langkah ini sendiri dan melaporkan hasilnya.

Jalankan `npm run dev` (harus di port 5173, satu-satunya origin yang diizinkan Neon Auth). Pakai agent-browser dengan session bernama sendiri, dan screenshot setiap hasil.

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Screenshot header sebelum dan sesudah perubahan | Logo "finlog" identik |
| 2 | Session browser baru (localStorage kosong). Klik logo → login | Toast "Masuk sebagai ...", tidak ada dialog pilihan (cloud kosong, lokal kosong = `same`) |
| 3 | Tambah satu pengeluaran, tunggu 5 detik | Satu request POST ke `.../finlog_snapshot` status 201; `finlog_cloud.dirty` = false |
| 4 | Session browser kedua (localStorage kosong), login | Pengeluaran dari langkah 3 muncul (`pull`) |
| 5 | Di session kedua ubah data, di session pertama ubah data lain tanpa menunggu, logout lalu login lagi di session pertama | Dialog "Data Berbeda" muncul; uji tombol "Pakai data cloud", ulangi dan uji "Pakai data device ini", ulangi dan tutup dialog (tidak ada yang berubah, tidak login) |
| 6 | Reload halaman saat login | Masih login; klik logo memunculkan toast logout |
| 7 | DevTools offline → tambah data → online | POST terkirim setelah online; `dirty` kembali false |
| 8 | Klik logo → Logout di toast | Toast "Berhasil keluar"; data lokal tetap ada; `finlog_cloud` terhapus |
| 9 | Password salah | Pesan "Email atau password salah." di dalam modal |

- [ ] **Step 6: Uji isolasi RLS (butuh izin user, menulis satu user ke Neon)**

Setelah user mengizinkan, buat akun kedua lewat curl dan pastikan akun itu tidak bisa membaca baris akun pertama:

```bash
A="https://ep-misty-hall-ay86z3wy.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth"
D="https://ep-misty-hall-ay86z3wy.apirest.c-5.us-east-2.aws.neon.tech/neondb/rest/v1"
J="$(mktemp)"
curl -s -c "$J" -X POST "$A/sign-up/email" -H "Content-Type: application/json" -H "Origin: http://localhost:5173" \
  -d '{"email":"iso@finlog.id","password":"IsoTest-12345","name":"iso"}' > /dev/null
T=$(curl -s -b "$J" "$A/token" -H "Origin: http://localhost:5173" | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
curl -s "$D/finlog_snapshot?select=user_id" -H "Authorization: Bearer $T"
```

Expected: `[]`. Kalau baris akun pertama ikut muncul, RLS rusak: hentikan dan laporkan.

Setelahnya, minta user menghapus `iso@finlog.id` di Neon Console dan mematikan sign-up publik kalau opsinya ada.

- [ ] **Step 7: Laporan akhir**

Laporkan apa adanya: test otomatis (jumlah lolos), ukuran bundle sebelum/sesudah, langkah manual mana yang dijalankan dan hasilnya, serta lubang yang tersisa. Yang pasti tersisa: Safari/iOS belum diuji.
