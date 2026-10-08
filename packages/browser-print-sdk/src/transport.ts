import type { BridgeEvent, BridgeRequest, BridgeResponse, MethodMap, MethodName, PageEnvelope } from '@xdev/shared-types';
import { BRIDGE_CHANNEL } from '@xdev/shared-types';
import { randomId } from '@xdev/core';
import { BrowserPrintError, BrowserPrintTimeoutError } from './errors';

export interface TransportOptions {
  extensionId?: string;
  /** Window to talk through (tests). */
  target?: Window;
}

interface Pending {
  resolve: (r: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Page ↔ content-script transport over window.postMessage. Messages are posted to the
 * page's own origin only, so they never leave the current document.
 */
export class PostMessageTransport {
  private readonly pending = new Map<string, Pending>();
  private readonly eventListeners = new Set<(e: BridgeEvent) => void>();
  private readyListeners = new Set<(extensionId: string) => void>();
  private detectedExtensionId: string | null = null;
  private readonly win: Window;
  private readonly onMessage = (event: MessageEvent) => this.handle(event);

  constructor(private readonly opts: TransportOptions = {}) {
    if (typeof window === 'undefined' && !opts.target) {
      throw new BrowserPrintError('UNSUPPORTED_CAPABILITY', 'xDev Browser Print SDK requires a browser window');
    }
    this.win = opts.target ?? window;
    this.win.addEventListener('message', this.onMessage);
  }

  get extensionId(): string | null {
    return this.detectedExtensionId;
  }

  dispose(): void {
    this.win.removeEventListener('message', this.onMessage);
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new BrowserPrintError('NOT_CONNECTED', 'Client disposed'));
    }
    this.pending.clear();
  }

  onEvent(fn: (e: BridgeEvent) => void): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  /** Resolves with the extension id when the content script answers, false after timeoutMs. */
  detect(timeoutMs: number): Promise<string | false> {
    if (this.detectedExtensionId) return Promise.resolve(this.detectedExtensionId);
    return new Promise((resolve) => {
      const done = (id: string | false) => {
        clearTimeout(timer);
        this.readyListeners.delete(listener);
        resolve(id);
      };
      const listener = (id: string) => done(id);
      const timer = setTimeout(() => done(false), timeoutMs);
      this.readyListeners.add(listener);
      this.post({ channel: BRIDGE_CHANNEL, dir: 'to-ext', kind: 'hello' });
    });
  }

  request<M extends MethodName>(method: M, params: MethodMap[M]['params'], timeoutMs: number): Promise<MethodMap[M]['result']> {
    const payload: BridgeRequest<M> = { requestId: randomId('req'), sentAt: Date.now(), method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(payload.requestId);
        reject(new BrowserPrintTimeoutError(`${method} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(payload.requestId, { resolve: resolve as (r: unknown) => void, reject, timer });
      this.post({
        channel: BRIDGE_CHANNEL,
        dir: 'to-ext',
        kind: 'request',
        payload: payload as BridgeRequest,
        ...(this.opts.extensionId && { targetExtensionId: this.opts.extensionId }),
      });
    });
  }

  private post(env: PageEnvelope) {
    this.win.postMessage(env, this.win.location.origin);
  }

  private handle(event: MessageEvent) {
    if (event.source !== this.win || event.origin !== this.win.location.origin) return;
    const data = event.data as PageEnvelope | undefined;
    if (!data || data.channel !== BRIDGE_CHANNEL || data.dir !== 'from-ext') return;
    if (this.opts.extensionId && data.extensionId !== this.opts.extensionId) return;
    if (data.kind === 'ready') {
      this.detectedExtensionId = data.extensionId;
      for (const l of [...this.readyListeners]) l(data.extensionId);
      return;
    }
    if (data.kind === 'event') {
      for (const l of this.eventListeners) l(data.payload);
      return;
    }
    if (data.kind === 'response') {
      const res = data.payload as BridgeResponse;
      const p = this.pending.get(res.requestId);
      if (!p) return;
      this.pending.delete(res.requestId);
      clearTimeout(p.timer);
      if (res.ok) p.resolve(res.result);
      else p.reject(BrowserPrintError.from(res.error));
    }
  }
}

