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
