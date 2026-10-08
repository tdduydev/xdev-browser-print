import type { PrintConfig, SiteGrant } from '@xdev/shared-types';
import { normalizeConfig } from '@xdev/core';

const CONFIG_KEY = 'config';
const SITES_KEY = 'sites';

/** Minimal surface of chrome.storage.local so tests can provide a fake. */
export interface KeyValueArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/**
 * All config writes go through one serialized queue in the service worker: chrome.storage
 * has no transactions and read-modify-write from several pages would lose updates.
 * Stored only in chrome.storage.local (never sync): the config describes this machine.
 */
export class ConfigStore {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly area: KeyValueArea) {}

  async getConfig(): Promise<PrintConfig> {
    const r = await this.area.get(CONFIG_KEY);
    return normalizeConfig(r[CONFIG_KEY]);
  }

  async getSites(): Promise<SiteGrant[]> {
    const r = await this.area.get(SITES_KEY);
    return Array.isArray(r[SITES_KEY]) ? (r[SITES_KEY] as SiteGrant[]) : [];
  }

  updateConfig(fn: (c: PrintConfig) => PrintConfig): Promise<PrintConfig> {
    return this.updateConfigWith((c) => {
      const config = fn(c);
      return { config, result: config };
    });
  }

  updateConfigWith<T>(fn: (c: PrintConfig) => { config: PrintConfig; result: T }): Promise<T> {
    return this.serialize(async () => {
      const { config, result } = fn(await this.getConfig());
      await this.area.set({ [CONFIG_KEY]: config });
      return result;
    });
  }

  updateSites(fn: (s: SiteGrant[]) => SiteGrant[]): Promise<SiteGrant[]> {
    return this.serialize(async () => {
      const next = fn(await this.getSites());
      await this.area.set({ [SITES_KEY]: next });
      return next;
    });
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }
}
