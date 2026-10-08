import type { ExtensionSettings, Scope } from '@xdev/shared-types';
import { normalizeOrigin, originToMatchPattern } from '@xdev/core';
import { callBackground } from './messages';

/**
 * Must be called synchronously from a click handler: chrome.permissions.request needs the
 * user gesture. The intent is sent to the service worker first because a popup can close
 * while Chrome's prompt is showing; the worker then finishes on permissions.onAdded.
 */
export function allowSite(origin: string, scopes: Scope[], confirmEachJob: boolean, settings: ExtensionSettings): Promise<void> {
  let canonical: string;
  try {
    canonical = normalizeOrigin(origin, settings);
  } catch (e) {
    return Promise.reject(e);
  }
  void callBackground('sites.pending', { origin: canonical, scopes, confirmEachJob }).catch(() => undefined);
  return chrome.permissions.request({ origins: [originToMatchPattern(canonical)] }).then(async (granted) => {
    if (!granted) throw new Error('Chrome permission was not granted');
    await callBackground('sites.add', { origin: canonical, scopes, confirmEachJob });
  });
}
