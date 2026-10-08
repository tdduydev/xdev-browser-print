import type { PrintJobRecord } from '@xdev/shared-types';

export type StoredPayload = { jobId: string; kind: 'bytes'; bytes: Uint8Array } | { jobId: string; kind: 'text'; text: string };

/** Persistence for job metadata (history) and transient payloads. */
export interface JobStore {
  put(job: PrintJobRecord): Promise<void>;
  get(jobId: string): Promise<PrintJobRecord | undefined>;
  findByIdempotency(origin: string, key: string): Promise<PrintJobRecord | undefined>;
  list(limit: number): Promise<PrintJobRecord[]>;
  listActive(): Promise<PrintJobRecord[]>;
  prune(keep: number): Promise<void>;
  clear(): Promise<void>;
  putPayload(p: StoredPayload): Promise<void>;
  getPayload(jobId: string): Promise<StoredPayload | undefined>;
  deletePayload(jobId: string): Promise<void>;
}

const ACTIVE = new Set(['CREATED', 'VALIDATING', 'WAITING_PERMISSION', 'QUEUED', 'DISPATCHING']);

export class MemoryJobStore implements JobStore {
  readonly jobs = new Map<string, PrintJobRecord>();
  readonly payloads = new Map<string, StoredPayload>();

  async put(job: PrintJobRecord) {
    this.jobs.set(job.jobId, structuredClone(job));
  }
  async get(jobId: string) {
    const j = this.jobs.get(jobId);
    return j ? structuredClone(j) : undefined;
  }
  async findByIdempotency(origin: string, key: string) {
    for (const j of this.jobs.values()) if (j.origin === origin && j.idempotencyKey === key) return structuredClone(j);
    return undefined;
  }
  async list(limit: number) {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((j) => structuredClone(j));
  }
  async listActive() {
    return [...this.jobs.values()].filter((j) => ACTIVE.has(j.state)).map((j) => structuredClone(j));
  }
  async prune(keep: number) {
    const sorted = [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
    for (const j of sorted.slice(keep)) if (!ACTIVE.has(j.state)) this.jobs.delete(j.jobId);
  }
  async clear() {
    for (const j of [...this.jobs.values()]) if (!ACTIVE.has(j.state)) this.jobs.delete(j.jobId);
  }
  async putPayload(p: StoredPayload) {
    this.payloads.set(p.jobId, p);
  }
  async getPayload(jobId: string) {
    return this.payloads.get(jobId);
  }
  async deletePayload(jobId: string) {
    this.payloads.delete(jobId);
  }
}

const DB_NAME = 'xdev-browser-print';
const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function openJobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      const jobs = db.createObjectStore('jobs', { keyPath: 'jobId' });
      jobs.createIndex('byIdem', ['origin', 'idempotencyKey'], { unique: true });
      jobs.createIndex('byCreated', 'createdAt');
      jobs.createIndex('byState', 'state');
      db.createObjectStore('payloads', { keyPath: 'jobId' });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/** IndexedDB is shared by every extension context (service worker and pages). */
export class IdbJobStore implements JobStore {
  private dbp: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    this.dbp ??= openJobDb();
    return this.dbp;
  }

  async put(job: PrintJobRecord) {
    const tx = (await this.db()).transaction('jobs', 'readwrite');
    tx.objectStore('jobs').put(job);
    await done(tx);
  }
  async get(jobId: string) {
    return req<PrintJobRecord | undefined>((await this.db()).transaction('jobs').objectStore('jobs').get(jobId));
  }
  async findByIdempotency(origin: string, key: string) {
    const idx = (await this.db()).transaction('jobs').objectStore('jobs').index('byIdem');
    return req<PrintJobRecord | undefined>(idx.get([origin, key]));
  }
  async list(limit: number) {
    const idx = (await this.db()).transaction('jobs').objectStore('jobs').index('byCreated');
    const out: PrintJobRecord[] = [];
    await new Promise<void>((resolve, reject) => {
      const cur = idx.openCursor(null, 'prev');
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c || out.length >= limit) return resolve();
        out.push(c.value as PrintJobRecord);
        c.continue();
      };
      cur.onerror = () => reject(cur.error);
    });
    return out;
  }
  async listActive() {
    const all = await req<PrintJobRecord[]>((await this.db()).transaction('jobs').objectStore('jobs').getAll());
    return all.filter((j) => ACTIVE.has(j.state));
  }
  async prune(keep: number) {
    const all = await this.list(Number.MAX_SAFE_INTEGER);
    const victims = all.slice(keep).filter((j) => !ACTIVE.has(j.state));
    if (!victims.length) return;
    const tx = (await this.db()).transaction('jobs', 'readwrite');
    for (const v of victims) tx.objectStore('jobs').delete(v.jobId);
    await done(tx);
  }
  async clear() {
    const all = await this.list(Number.MAX_SAFE_INTEGER);
    const tx = (await this.db()).transaction('jobs', 'readwrite');
    for (const v of all) if (!ACTIVE.has(v.state)) tx.objectStore('jobs').delete(v.jobId);
    await done(tx);
  }
  async putPayload(p: StoredPayload) {
    const tx = (await this.db()).transaction('payloads', 'readwrite');
    tx.objectStore('payloads').put(p);
    await done(tx);
  }
  async getPayload(jobId: string) {
    return req<StoredPayload | undefined>((await this.db()).transaction('payloads').objectStore('payloads').get(jobId));
  }
  async deletePayload(jobId: string) {
    const tx = (await this.db()).transaction('payloads', 'readwrite');
    tx.objectStore('payloads').delete(jobId);
    await done(tx);
  }
}
