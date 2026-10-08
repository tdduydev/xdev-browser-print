import type {
  BridgeRequest,
  BridgeResponse,
  Capabilities,
  ConnectParams,
  MethodMap,
  MethodName,
  PrintConfig,
  PrinterStatus,
  PublicPrinter,
  Scope,
  SiteGrant,
} from '@xdev/shared-types';
import { METHOD_SCOPES, PROTOCOL_VERSION, SCOPES } from '@xdev/shared-types';
import { PrintError, ReplayGuard, deleteMapping, saveMapping, toSerializedError, validateDocumentType } from '@xdev/core';
import type { ConfigStore } from '../storage/config-store';
import type { JobManager } from '../printing/job-manager';
import { toPublic } from '../printing/job-manager';

export interface ApiDeps {
  extensionId: string;
  extensionVersion: string;
  configStore: ConfigStore;
  jobs: JobManager;
  capabilities: () => Promise<Capabilities>;
  printerStatus: (profileId: string) => Promise<PrinterStatus>;
  /** Opens the approval window. Resolves with the scopes the user accepted (empty = denied). */
  requestPairing: (origin: string, scopes: Scope[], appName?: string) => Promise<Scope[]>;
  queuedJobs: () => Promise<number>;
}

type Handler<M extends MethodName> = (origin: string, params: MethodMap[M]['params'], grant: SiteGrant | undefined) => Promise<MethodMap[M]['result']>;

/**
 * Every request from a web page lands here with the origin taken from the Chrome port
 * sender (never from the message body). Authorization is: exact-origin grant + scope.
 */
export class PageApi {
  private readonly replay = new ReplayGuard();
  private readonly handlers: { [M in MethodName]: Handler<M> };

  constructor(private readonly deps: ApiDeps) {
    this.handlers = {
      ping: async () => ({ extensionId: deps.extensionId, extensionVersion: deps.extensionVersion, protocolVersion: PROTOCOL_VERSION }),
      connect: (origin, params, grant) => this.connect(origin, params, grant),
      disconnect: async () => ({ ok: true as const }),
      getStatus: async (origin, _p, grant) => {
        const config = await deps.configStore.getConfig();
        return {
          extensionVersion: deps.extensionVersion,
          connected: true,
          origin,
          scopes: grant?.scopes ?? [],
          profiles: config.profiles.length,
          mappings: Object.keys(config.mappings).length,
          queuedJobs: await deps.queuedJobs(),
        };
      },
      getCapabilities: () => deps.capabilities(),
      getPrinters: async () => {
        const config = await deps.configStore.getConfig();
        return Promise.all(config.profiles.map(async (p): Promise<PublicPrinter> => ({
          id: p.id,
          name: p.name,
          adapter: p.adapter,
          category: p.category,
          paperSize: p.paperSize,
          isDefault: !!p.isDefault,
          status: await deps.printerStatus(p.id).catch(() => ({ ready: false, reason: 'STATUS_UNAVAILABLE' })),
        })));
      },
      getMappings: async () => Object.values((await deps.configStore.getConfig()).mappings),
      saveMapping: async (_origin, params) => {
        await this.assertSiteConfigureAllowed();
        return deps.configStore.updateConfigWith((c) => {
          const r = saveMapping(c, params);
          return { config: r.config, result: r.mapping };
        });
      },
      deleteMapping: async (_origin, params) => {
        await this.assertSiteConfigureAllowed();
        const documentType = validateDocumentType(params?.documentType);
        const config = await deps.configStore.getConfig();
        if (!config.mappings[documentType]) throw new PrintError('MAPPING_NOT_FOUND', 'Mapping not found');
        await deps.configStore.updateConfig((c) => deleteMapping(c, documentType));
        return { ok: true as const };
      },
      print: (origin, params, grant) => deps.jobs.submit(origin, params, { requireConfirmation: !!grant?.confirmEachJob }),
      getJobStatus: async (origin, params) => {
        const job = params?.jobId
          ? await deps.jobs.get(params.jobId)
          : params?.idempotencyKey
            ? await deps.jobs.findByIdempotency(origin, params.idempotencyKey)
            : undefined;
        // A site only ever sees its own jobs.
        if (!job || job.origin !== origin) throw new PrintError('JOB_NOT_FOUND', 'Job not found');
        return toPublic(job);
      },
      cancelJob: async (origin, params) => {
        const job = await deps.jobs.get(params?.jobId);
        if (!job || job.origin !== origin) throw new PrintError('JOB_NOT_FOUND', 'Job not found');
        return toPublic(await deps.jobs.cancel(job.jobId));
      },
    };
  }

  async handle(origin: string, req: BridgeRequest): Promise<BridgeResponse> {
    const requestId = typeof req?.requestId === 'string' ? req.requestId : '';
    try {
      if (!req || typeof req !== 'object' || typeof req.method !== 'string' || !(req.method in this.handlers)) {
        throw new PrintError('INVALID_REQUEST', 'Unknown method');
      }
      this.replay.check(origin, requestId, req.sentAt);
      const method = req.method as MethodName;
      const grant = (await this.deps.configStore.getSites()).find((s) => s.origin === origin);
      const scope = METHOD_SCOPES[method];
      if (scope !== null) {
        if (!grant) throw new PrintError('ORIGIN_NOT_ALLOWED', 'This site is not paired with xDev Browser Print');
        if (!grant.scopes.includes(scope)) throw new PrintError('PERMISSION_DENIED', `Missing "${scope}" permission`, { scope });
      }
      const handler = this.handlers[method] as Handler<MethodName>;
      const result = await handler(origin, req.params as never, grant);
      return { requestId, ok: true, result };
    } catch (e) {
      return { requestId, ok: false, error: toSerializedError(e) };
    }
  }

  private async connect(origin: string, params: ConnectParams, grant: SiteGrant | undefined) {
    const config = await this.deps.configStore.getConfig();
    const requested = sanitizeScopes(params?.scopes, config);
    const have = grant?.scopes ?? [];
    const missing = requested.filter((s) => !have.includes(s));
    let scopes = have;
    if (missing.length || !grant) {
      const accepted = await this.deps.requestPairing(origin, missing.length ? missing : requested, typeof params?.appName === 'string' ? params.appName.slice(0, 80) : undefined);
      if (!accepted.length && !grant) throw new PrintError('PAIRING_REJECTED', 'The user did not approve this site');
      scopes = [...new Set([...have, ...accepted])];
    }
    return {
      extensionId: this.deps.extensionId,
      extensionVersion: this.deps.extensionVersion,
      protocolVersion: PROTOCOL_VERSION,
      origin,
      scopes,
    };
  }

  private async assertSiteConfigureAllowed() {
    const { settings } = await this.deps.configStore.getConfig();
    if (!settings.allowSiteConfigure) throw new PrintError('PERMISSION_DENIED', 'Site configuration is disabled in extension settings');
  }
}

function sanitizeScopes(input: unknown, config: PrintConfig): Scope[] {
  const list = Array.isArray(input) ? input.filter((s): s is Scope => SCOPES.includes(s as Scope)) : [];
  const scopes = list.length ? list : (['read', 'print'] as Scope[]);
  return [...new Set(scopes)].filter((s) => s !== 'configure' || config.settings.allowSiteConfigure);
}
