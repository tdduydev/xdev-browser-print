import type { Scope } from '@xdev/shared-types';
import { randomId } from '@xdev/core';
import type { ConfirmRequest } from '../printing/job-manager';

export type ApprovalRequest =
  | { id: string; kind: 'pair'; origin: string; scopes: Scope[]; appName?: string; createdAt: number }
  | { id: string; kind: 'job'; job: ConfirmRequest; createdAt: number };

export type ApprovalAnswer = { approved: boolean; scopes?: Scope[] };

interface Pending {
  req: ApprovalRequest;
  windowId?: number;
  resolve: (a: ApprovalAnswer) => void;
  timer: ReturnType<typeof setTimeout>;
}

const TIMEOUT_MS = 2 * 60_000;

/** User approval windows for pairing and per-job confirmation. Pending state is in memory. */
export class ApprovalCenter {
  private readonly pending = new Map<string, Pending>();
  private readonly byOrigin = new Map<string, Promise<ApprovalAnswer>>();

  get(id: string): ApprovalRequest | undefined {
    return this.pending.get(id)?.req;
  }

  async requestPairing(origin: string, scopes: Scope[], appName?: string): Promise<Scope[]> {
    // A page calling connect() repeatedly must not open a stack of windows.
    let p = this.byOrigin.get(origin);
    if (!p) {
      p = this.open({ id: randomId('apr'), kind: 'pair', origin, scopes, ...(appName && { appName }), createdAt: Date.now() });
      this.byOrigin.set(origin, p);
      void p.finally(() => this.byOrigin.delete(origin));
    }
    const answer = await p;
    if (!answer.approved) return [];
    return (answer.scopes ?? scopes).filter((s) => scopes.includes(s));
  }

  async confirmJob(job: ConfirmRequest): Promise<boolean> {
    const a = await this.open({ id: randomId('apr'), kind: 'job', job, createdAt: Date.now() });
    return a.approved;
  }

  respond(id: string, answer: ApprovalAnswer): boolean {
    const p = this.pending.get(id);
    if (!p) return false;
    this.settle(id, answer);
    if (p.windowId !== undefined) void chrome.windows.remove(p.windowId).catch(() => undefined);
    return true;
  }

  onWindowRemoved(windowId: number): void {
    for (const [id, p] of this.pending) if (p.windowId === windowId) this.settle(id, { approved: false });
  }

  private open(req: ApprovalRequest): Promise<ApprovalAnswer> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.respond(req.id, { approved: false }), TIMEOUT_MS);
      const entry: Pending = { req, resolve, timer };
      this.pending.set(req.id, entry);
      chrome.windows
        .create({ url: chrome.runtime.getURL(`approve.html?id=${encodeURIComponent(req.id)}`), type: 'popup', width: 480, height: 600, focused: true })
        .then((w) => {
          entry.windowId = w?.id;
        })
        .catch(() => this.settle(req.id, { approved: false }));
    });
  }

  private settle(id: string, answer: ApprovalAnswer) {
    const p = this.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(id);
    p.resolve(answer);
  }
}
