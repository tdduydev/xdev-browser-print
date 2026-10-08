import { useCallback, useEffect, useState } from 'react';
import type { PrintConfig, SiteGrant } from '@xdev/shared-types';
import { callBackground, type Broadcast } from '../lib/messages';
import { setLanguage } from './i18n';

export function useConfig() {
  const [data, setData] = useState<{ config: PrintConfig; sites: SiteGrant[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const d = await callBackground('config.get', {});
      setLanguage(d.config.settings.language);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useBroadcast('broadcast.config', reload);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}

export function useBroadcast(type: Broadcast['type'], fn: () => void) {
  useEffect(() => {
    const listener = (msg: Broadcast) => {
      if (msg?.type === type) fn();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [type, fn]);
}

export function errorText(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const err = (e as { error: { code: string; message: string } }).error;
    return `${err.code}: ${err.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}
