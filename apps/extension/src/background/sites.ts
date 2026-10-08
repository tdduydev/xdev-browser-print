import type { Scope, SiteGrant } from '@xdev/shared-types';
import { SCOPES } from '@xdev/shared-types';
import { PrintError, normalizeOrigin, originToMatchPattern } from '@xdev/core';
import type { ConfigStore } from '../storage/config-store';

const SCRIPT_PREFIX = 'xdbp-';
const PENDING_KEY = 'pendingSite';

function scriptId(pattern: string): string {
  return SCRIPT_PREFIX + pattern.replace(/[^a-z0-9]/gi, '_');
}

export function sanitizeGrantScopes(scopes: unknown): Scope[] {
  const list = Array.isArray(scopes) ? scopes.filter((s): s is Scope => SCOPES.includes(s as Scope)) : [];
  return [...new Set(list)];
}

/**
 * A site is "allowed" only when three things agree: a stored grant for the exact origin,
 * a Chrome host permission the user granted, and our dynamically registered content script.
 * Content scripts are never declared statically, so no page gets the bridge by default.
 */
export class SiteManager {
  constructor(private readonly store: ConfigStore) {}

  async list(): Promise<SiteGrant[]> {
    return this.store.getSites();
  }

  async find(origin: string): Promise<SiteGrant | undefined> {
    return (await this.store.getSites()).find((s) => s.origin === origin);
  }

  /** Remembered before chrome.permissions.request, because a popup may close mid-prompt. */
  async setPending(origin: string, scopes: Scope[], confirmEachJob: boolean): Promise<void> {
    const { settings } = await this.store.getConfig();
    const canonical = normalizeOrigin(origin, settings);
    await chrome.storage.session.set({ [PENDING_KEY]: { origin: canonical, scopes: sanitizeGrantScopes(scopes), confirmEachJob, at: Date.now() } });
  }

  async completePendingFor(patterns: string[]): Promise<void> {
    const r = await chrome.storage.session.get(PENDING_KEY);
    const pending = r[PENDING_KEY] as { origin: string; scopes: Scope[]; confirmEachJob: boolean; at: number } | undefined;
    if (!pending || Date.now() - pending.at > 5 * 60_000) return;
    if (!patterns.includes(originToMatchPattern(pending.origin))) return;
    await chrome.storage.session.remove(PENDING_KEY);
    await this.add(pending.origin, pending.scopes, pending.confirmEachJob);
  }

  async add(origin: string, scopes: Scope[], confirmEachJob = false, label?: string): Promise<SiteGrant> {
    const { settings } = await this.store.getConfig();
    const canonical = normalizeOrigin(origin, settings);
    const pattern = originToMatchPattern(canonical);
    if (!(await chrome.permissions.contains({ origins: [pattern] }))) {
      throw new PrintError('PERMISSION_DENIED', 'Chrome host permission for this site was not granted');
    }
    const clean = sanitizeGrantScopes(scopes).filter((s) => s !== 'configure' || settings.allowSiteConfigure);
    let grant!: SiteGrant;
    await this.store.updateSites((sites) => {
      const prev = sites.find((s) => s.origin === canonical);
      grant = { origin: canonical, scopes: clean, grantedAt: prev?.grantedAt ?? Date.now(), confirmEachJob, ...(label && { label }) };
      return [...sites.filter((s) => s.origin !== canonical), grant];
    });
    await this.ensureContentScript(pattern);
    await this.injectIntoOpenTabs(pattern);
    return grant;
  }

  async addScopes(origin: string, scopes: Scope[]): Promise<SiteGrant | undefined> {
    let out: SiteGrant | undefined;
    await this.store.updateSites((sites) =>
      sites.map((s) => {
        if (s.origin !== origin) return s;
        out = { ...s, scopes: [...new Set([...s.scopes, ...sanitizeGrantScopes(scopes)])] };
        return out;
      }),
    );
    return out;
  }

  async update(origin: string, patch: { scopes?: Scope[]; confirmEachJob?: boolean }): Promise<void> {
    await this.store.updateSites((sites) =>
      sites.map((s) =>
        s.origin === origin
          ? { ...s, ...(patch.scopes && { scopes: sanitizeGrantScopes(patch.scopes) }), ...(patch.confirmEachJob !== undefined && { confirmEachJob: patch.confirmEachJob }) }
          : s,
      ),
    );
  }

  async remove(origin: string): Promise<void> {
    const sites = await this.store.updateSites((list) => list.filter((s) => s.origin !== origin));
    const pattern = originToMatchPattern(origin);
    // Several origins (ports) can share one host pattern; keep the script while one remains.
    if (!sites.some((s) => originToMatchPattern(s.origin) === pattern)) {
      await chrome.scripting.unregisterContentScripts({ ids: [scriptId(pattern)] }).catch(() => undefined);
      await chrome.permissions.remove({ origins: [pattern] }).catch(() => undefined);
    }
  }

  /** Startup: drop grants whose host permission was revoked in chrome://extensions, re-register scripts. */
  async reconcile(): Promise<void> {
    const sites = await this.store.getSites();
    const keep: SiteGrant[] = [];
    for (const s of sites) {
      const pattern = originToMatchPattern(s.origin);
      if (await chrome.permissions.contains({ origins: [pattern] })) {
        keep.push(s);
        await this.ensureContentScript(pattern);
      }
    }
    if (keep.length !== sites.length) await this.store.updateSites(() => keep);
    const wanted = new Set(keep.map((s) => scriptId(originToMatchPattern(s.origin))));
    const registered = await chrome.scripting.getRegisteredContentScripts();
    const stale = registered.filter((r) => r.id.startsWith(SCRIPT_PREFIX) && !wanted.has(r.id)).map((r) => r.id);
    if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });
  }

  async onPermissionsRemoved(origins: string[]): Promise<string[]> {
    const sites = await this.store.getSites();
    const gone = sites.filter((s) => origins.includes(originToMatchPattern(s.origin))).map((s) => s.origin);
    for (const o of gone) await this.remove(o);
    return gone;
  }

  private async ensureContentScript(pattern: string): Promise<void> {
    const id = scriptId(pattern);
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    if (existing.length) return;
    await chrome.scripting.registerContentScripts([
      { id, matches: [pattern], js: ['content.js'], runAt: 'document_start', allFrames: false, persistAcrossSessions: true },
    ]);
  }

  private async injectIntoOpenTabs(pattern: string): Promise<void> {
    const tabs = await chrome.tabs.query({ url: pattern }).catch(() => [] as chrome.tabs.Tab[]);
    await Promise.all(
      tabs.filter((t) => t.id !== undefined).map((t) => chrome.scripting.executeScript({ target: { tabId: t.id! }, files: ['content.js'] }).catch(() => undefined)),
    );
  }
}
