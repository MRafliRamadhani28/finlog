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
