import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConnectResult, PublicJobStatus, PublicPrinter } from '@xdev/shared-types';
import { XDevBrowserPrint, type PrintOptions, type XDevBrowserPrintOptions } from './client';
import { BrowserPrintError } from './errors';

export type BrowserPrintState = 'detecting' | 'not-installed' | 'ready' | 'connecting' | 'connected' | 'error';

export interface UseBrowserPrintResult {
  client: XDevBrowserPrint | null;
  state: BrowserPrintState;
  session: ConnectResult | null;
  printers: PublicPrinter[];
  error: BrowserPrintError | null;
  lastJob: PublicJobStatus | null;
  connect: () => Promise<void>;
  refreshPrinters: () => Promise<void>;
  print: (options: PrintOptions) => Promise<PublicJobStatus>;
}

/**
 * React 18/19 hook. Detects the extension on mount; connect() must be called explicitly
 * (usually from a button) because it may open the extension's approval window.
 */
export function useBrowserPrint(options: XDevBrowserPrintOptions = {}): UseBrowserPrintResult {
  const optsKey = JSON.stringify({ ...options, target: undefined });
  const optsRef = useRef(options);
  optsRef.current = options;
  const [client, setClient] = useState<XDevBrowserPrint | null>(null);
  const [state, setState] = useState<BrowserPrintState>('detecting');
  const [session, setSession] = useState<ConnectResult | null>(null);
  const [printers, setPrinters] = useState<PublicPrinter[]>([]);
  const [error, setError] = useState<BrowserPrintError | null>(null);
  const [lastJob, setLastJob] = useState<PublicJobStatus | null>(null);

  useEffect(() => {
    const c = new XDevBrowserPrint(optsRef.current);
    let alive = true;
    setClient(c);
    setState('detecting');
    const off = c.onStatusChanged((e) => {
      if (e.type === 'job') setLastJob(e.job);
    });
    void c.isInstalled().then((ok) => {
      if (alive) setState(ok ? 'ready' : 'not-installed');
    });
    return () => {
      alive = false;
      off();
      c.dispose();
    };
  }, [optsKey]);

  const toError = (e: unknown) => (e instanceof BrowserPrintError ? e : new BrowserPrintError('INTERNAL_ERROR', e instanceof Error ? e.message : String(e)));

  const refreshPrinters = useCallback(async () => {
    if (!client) return;
    setPrinters(await client.getPrinters());
  }, [client]);

  const connect = useCallback(async () => {
    if (!client) return;
    setState('connecting');
    setError(null);
    try {
      const s = await client.connect();
      setSession(s);
      setState('connected');
      if (s.scopes.includes('read')) setPrinters(await client.getPrinters());
    } catch (e) {
      const err = toError(e);
      setError(err);
      setState(err.code === 'NOT_INSTALLED' ? 'not-installed' : 'error');
    }
  }, [client]);

  const print = useCallback(
    async (o: PrintOptions) => {
      if (!client) throw new BrowserPrintError('NOT_CONNECTED', 'Client not ready');
      try {
        const job = await client.print(o);
        setLastJob(job);
        return job;
      } catch (e) {
        setError(toError(e));
        throw e;
      }
    },
    [client],
  );

  return useMemo(
    () => ({ client, state, session, printers, error, lastJob, connect, refreshPrinters, print }),
    [client, state, session, printers, error, lastJob, connect, refreshPrinters, print],
  );
}

export { XDevBrowserPrint };
export type { PrintOptions, XDevBrowserPrintOptions };
