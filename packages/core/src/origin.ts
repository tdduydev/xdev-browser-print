import { PrintError } from './errors';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface OriginPolicy {
  allowLocalhost: boolean;
}

/**
 * Returns the canonical origin, or throws. Wildcards, paths, credentials and
 * non-https remote origins are rejected so a grant always names exactly one site.
 */
export function normalizeOrigin(input: string, policy: OriginPolicy): string {
  const raw = input.trim();
  if (raw.includes('*')) throw new PrintError('ORIGIN_NOT_ALLOWED', 'Wildcard origins are not accepted');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PrintError('INVALID_REQUEST', 'Invalid origin');
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  // Scheme first, so e.g. file:/// is reported as "not allowed" rather than "has a path".
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new PrintError('ORIGIN_NOT_ALLOWED', 'Only https origins (or http://localhost for development) are accepted');
  }
  if (isLocal && !policy.allowLocalhost) throw new PrintError('ORIGIN_NOT_ALLOWED', 'Localhost origins are disabled');
  if (url.username || url.password) throw new PrintError('INVALID_REQUEST', 'Origin must not contain credentials');
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new PrintError('INVALID_REQUEST', 'Origin must not contain a path, query or fragment');
  }
  return url.origin;
}

export function originToMatchPattern(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}

/** Content scripts match by host (any port), so the exact origin is re-checked here. */
export function originOfUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.origin === 'null' ? null : parsed.origin;
  } catch {
    return null;
  }
}
