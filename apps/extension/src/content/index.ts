import type { BridgeEvent, BridgeResponse, PageEnvelope } from '@xdev/shared-types';
import { BRIDGE_CHANNEL, BRIDGE_PORT_NAME, PROTOCOL_VERSION } from '@xdev/shared-types';

/**
 * Relay between the page (window.postMessage) and the service worker (runtime port).
 * Registered only for origins the user allowed. It holds no privileges itself: the
 * service worker re-checks the origin Chrome reports for this port on every request.
 */
declare global {
  interface Window {
    __xdevBrowserPrintBridge?: boolean;
  }
}

const MAX_MESSAGE_CHARS = 70 * 1024 * 1024;

function start() {
  if (window.__xdevBrowserPrintBridge) return; // injected twice (registration + executeScript)
  window.__xdevBrowserPrintBridge = true;

  const extensionId = chrome.runtime.id;
  const origin = window.location.origin;
  let port: chrome.runtime.Port | null = null;
  const inflight = new Set<string>();

  const toPage = (env: PageEnvelope) => window.postMessage(env, origin);

  const failInflight = () => {
    for (const requestId of inflight) {
      const payload: BridgeResponse = {
        requestId,
        ok: false,
        error: { code: 'EXTENSION_DISCONNECTED', message: 'Extension connection lost (reloaded or updated)' },
      };
      toPage({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'response', payload, extensionId });
    }
    inflight.clear();
  };

  const getPort = (): chrome.runtime.Port | null => {
    if (port) return port;
    try {
      port = chrome.runtime.connect({ name: BRIDGE_PORT_NAME });
    } catch {
      return null; // extension context invalidated (extension reloaded)
    }
    port.onMessage.addListener((msg: { kind: 'response'; payload: BridgeResponse } | { kind: 'event'; payload: BridgeEvent }) => {
      if (msg.kind === 'response') {
        inflight.delete(msg.payload.requestId);
        toPage({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'response', payload: msg.payload, extensionId });
      } else if (msg.kind === 'event') {
        toPage({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'event', payload: msg.payload, extensionId });
      }
    });
    // Service worker suspended/restarted or site revoked: reconnect lazily on next request.
    port.onDisconnect.addListener(() => {
      port = null;
      failInflight();
      toPage({
        channel: BRIDGE_CHANNEL,
        dir: 'from-ext',
        kind: 'event',
        payload: { type: 'status', status: { reason: 'PORT_DISCONNECTED' } },
        extensionId,
      });
    });
    return port;
  };

  window.addEventListener('message', (event: MessageEvent) => {
    // Same window and same origin only: frames and other windows cannot use the bridge.
    if (event.source !== window || event.origin !== origin) return;
    const data = event.data as PageEnvelope | undefined;
    if (!data || data.channel !== BRIDGE_CHANNEL || data.dir !== 'to-ext') return;
    if (data.kind === 'hello') {
      toPage({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'ready', extensionId, protocolVersion: PROTOCOL_VERSION });
      return;
    }
    if (data.kind !== 'request' || !data.payload || typeof data.payload.requestId !== 'string') return;
    if (data.targetExtensionId && data.targetExtensionId !== extensionId) return;
    const req = data.payload;
    const reject = (code: 'EXTENSION_DISCONNECTED' | 'PAYLOAD_TOO_LARGE', message: string) =>
      toPage({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'response', payload: { requestId: req.requestId, ok: false, error: { code, message } }, extensionId });
    const data_ = (req.params as { data?: unknown } | undefined)?.data;
    if (typeof data_ === 'string' && data_.length > MAX_MESSAGE_CHARS) return reject('PAYLOAD_TOO_LARGE', 'Payload too large');
    const p = getPort();
    if (!p) return reject('EXTENSION_DISCONNECTED', 'Extension was reloaded; refresh the page');
    inflight.add(req.requestId);
    try {
      p.postMessage({ kind: 'request', payload: req });
    } catch {
      inflight.delete(req.requestId);
      port = null;
      reject('EXTENSION_DISCONNECTED', 'Extension connection lost');
    }
  });

  // Announce once so an SDK that loaded first can detect us without polling.
  toPage({ channel: BRIDGE_CHANNEL, dir: 'from-ext', kind: 'ready', extensionId, protocolVersion: PROTOCOL_VERSION });
}

start();
