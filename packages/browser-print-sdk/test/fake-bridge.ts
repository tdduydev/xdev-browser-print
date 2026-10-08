import type { BridgeEvent, BridgeRequest, BridgeResponse, PageEnvelope, PublicJobStatus } from '@xdev/shared-types';
import { BRIDGE_CHANNEL } from '@xdev/shared-types';

export const ORIGIN = 'https://his.example.vn';

/** Minimal Window stand-in: same-window postMessage with source/origin like Chrome sets them. */
export class FakeWindow extends EventTarget {
  location = { origin: ORIGIN };
  postMessage(data: unknown, targetOrigin: string) {
    if (targetOrigin !== this.location.origin) throw new Error(`unexpected targetOrigin ${targetOrigin}`);
    setTimeout(() => this.inject(data));
  }
  inject(data: unknown, over: { origin?: string; source?: unknown } = {}) {
    const ev = new Event('message') as Event & { data: unknown; origin: string; source: unknown };
    Object.assign(ev, { data, origin: over.origin ?? this.location.origin, source: 'source' in over ? over.source : this });
    this.dispatchEvent(ev);
  }
}

type Handler = (req: BridgeRequest) => unknown | Promise<unknown>;

/** Plays the content script + service worker. */
export class FakeBridge {
  requests: BridgeRequest[] = [];
  handlers: Record<string, Handler> = {};
  silent = false;

  constructor(
    readonly win: FakeWindow,
    readonly extensionId = 'ext-1',
  ) {
    win.addEventListener('message', (e) => {
      const data = (e as MessageEvent).data as PageEnvelope;
      if (this.silent || data?.channel !== BRIDGE_CHANNEL || data.dir !== 'to-ext') return;
      if (data.kind === 'hello') this.send({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'ready', extensionId: this.extensionId, protocolVersion: 1 });
      if (data.kind === 'request') void this.handle(data.payload);
    });
  }

  on(method: string, h: Handler) {
    this.handlers[method] = h;
    return this;
  }

  event(payload: BridgeEvent) {
    this.send({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'event', payload, extensionId: this.extensionId });
  }

  private async handle(req: BridgeRequest) {
    this.requests.push(req);
    const h = this.handlers[req.method];
    let payload: BridgeResponse;
    if (!h) payload = { requestId: req.requestId, ok: false, error: { code: 'INVALID_REQUEST', message: 'no handler' } };
    else {
      try {
        const result = await h(req);
        if (result === NO_REPLY) return;
        payload = { requestId: req.requestId, ok: true, result: result as never };
      } catch (e) {
        payload = { requestId: req.requestId, ok: false, error: e as never };
      }
    }
    this.send({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'response', payload, extensionId: this.extensionId });
  }

  private send(env: PageEnvelope) {
    setTimeout(() => this.win.inject(env));
  }
}

export const NO_REPLY = Symbol('no-reply');

export function job(over: Partial<PublicJobStatus> = {}): PublicJobStatus {
  return { jobId: 'job_1', idempotencyKey: 'k', documentType: 'PRESCRIPTION', format: 'PDF', state: 'QUEUED', createdAt: 1, updatedAt: 1, ...over };
}
