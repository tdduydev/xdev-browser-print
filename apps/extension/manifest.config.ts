import pkg from './package.json' with { type: 'json' };

/**
 * Permissions are the minimum the features need (see docs/CHROME_WEB_STORE.md for the
 * per-permission justification). Host access is optional and requested per exact site.
 */
/** E2E builds pre-grant localhost so tests need no permission prompt (never shipped). */
export const isE2E = process.env.XDBP_E2E === '1';

export function buildManifest() {
  return {
    manifest_version: 3,
    name: 'xDev Browser Print',
    short_name: 'xDev Print',
    description: '__MSG_extDescription__',
    default_locale: 'vi',
    version: pkg.version,
    author: 'xDev',
    minimum_chrome_version: '118',
    icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
    action: {
      default_title: 'xDev Browser Print',
      default_popup: 'popup.html',
      default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' },
    },
    options_ui: { page: 'options.html', open_in_tab: true },
    background: { service_worker: 'background.js', type: 'module' },
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    ...(isE2E && { host_permissions: ['http://localhost/*'] }),
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'",
    },
  };
}
