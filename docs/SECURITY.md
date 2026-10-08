# Security — xDev Browser Print

Vietnamese version: [vi/SECURITY.md](vi/SECURITY.md)

## 1. Trust model

| Component | Trust | Reason |
|---|---|---|
| Service worker, extension pages | Trusted | Extension code, under the Manifest V3 CSP. |
| Origins the user allowed | Trusted within their scopes | Any script on that origin can use the SDK. The trust boundary is the **origin**, not individual scripts. |
| Content script | No privileges | Only relays messages. The service worker re-checks every request. |
| Other websites, iframes, other windows | Untrusted | No content script, or rejected by the origin check. |
| HTML/PDF sent by a site | Untrusted | Rendered after sanitization, in a sandboxed iframe. |

## 2. Controls

| # | Control | Implemented in | Test |
|---|---|---|---|
| S1 | Exact origins only. No wildcards, paths, queries or credentials. `https:` only. `http://localhost` and `http://127.0.0.1` only when the `allowLocalhost` setting is on. | `core/src/origin.ts` | `origin.test.ts` |
| S2 | Content scripts are registered only for hosts the user allowed. The manifest has no `content_scripts`. | `background/sites.ts` | e2e "never allowed gets no bridge" |
| S3 | The origin comes from `port.sender.origin`, set by Chrome. The message body is never trusted for the origin. | `background/index.ts` | e2e "another port on an allowed host" |
| S4 | The bridge accepts ports only from this extension's content script, in the top frame (`frameId === 0`) of a tab. | `background/index.ts` | Code review |
| S5 | The content script accepts only messages with `event.source === window` and `event.origin === location.origin`, and posts replies only to the page's own origin. | `content/index.ts` | SDK test "ignores messages from other origins" |
| S6 | Scopes `read`, `print`, `configure` per method (`METHOD_SCOPES`). | `background/api.ts` | `page-api.test.ts`, e2e "scopes are enforced" |
| S7 | Extra scopes need user approval in `approve.html`. Requests expire after 2 minutes. One approval window per origin at a time. | `background/approvals.ts` | e2e approve / deny |
| S8 | Setting `allowSiteConfigure = false` blocks all mapping changes from sites, even with the `configure` scope. | `background/api.ts` | `page-api.test.ts` |
| S9 | Replay protection: `requestId` cannot be reused; `sentAt` more than 60 s off is rejected. | `core/src/replay.ts` | `jobs-and-guards.test.ts`, `page-api.test.ts` |
| S10 | Duplicate protection: `idempotencyKey` per origin. A duplicate returns the existing job and does not print again. | `printing/job-manager.ts` | unit + e2e |
| S11 | Per-origin rate limit. Default 20 jobs / 60 s. | `core/src/rate-limit.ts` | unit + e2e |
| S12 | Size limit. Default 15 MB decoded. The content script drops messages over 70 M characters. | `core/src/validation.ts`, `content/index.ts` | unit + e2e |
| S13 | Data labelled PDF MUST start with `%PDF`. | `core/src/validation.ts` | e2e "invalid documents" |
| S14 | Site HTML: DOMPurify removes `script`, `iframe`, `object`, `embed`, `form`, `input`, `base`, `meta`, `link`, event handlers and `javascript:` URLs. The result is shown in an iframe with `sandbox="allow-same-origin allow-modals"`. | `print/render.ts` | `render.test.ts`, e2e HTML job |
| S15 | A site only sees its own jobs. | `background/api.ts` | `page-api.test.ts` |
| S16 | Unexpected errors return a generic message, never the original message (which could contain patient data). | `core/src/errors.ts` | `page-api.test.ts` |
| S17 | Print history stores metadata only. Payloads are deleted when the job ends. | `printing/job-manager.ts` | unit + e2e "metadata only" |
| S18 | `getPrinters()` never returns serial numbers, vendor ids or port settings. | `background/api.ts` | `page-api.test.ts` |
| S19 | A site can require confirmation for every job. The job waits in `WAITING_PERMISSION` until the user approves. | `printing/job-manager.ts` | `job-manager.test.ts` |
| S20 | Internal messages (options, popup, print window) are accepted only when `sender.url` belongs to the extension. Content scripts share the extension id but have a web URL, so they are rejected. | `background/index.ts` | Code review |

## 3. Manifest V3 and CSP

- `content_security_policy.extension_pages`: `script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'`.
- No `eval`, `new Function` or CDN scripts. ESLint enforces `no-eval`, `no-implied-eval`, `no-new-func`.
- All code is bundled in the release package.

## 4. Extension permissions

| Permission | Used for |
|---|---|
| `storage` | Configuration and grants in `chrome.storage.local`. |
| `scripting` | Registering the content script for each allowed origin. |
| `activeTab` | The popup reads the current tab's URL to offer "Allow this website". |
| `optional_host_permissions`: `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*` | Requested for **one host** when the user adds a site. No host access at install time. |

The e2e build (`XDBP_E2E=1`, folder `dist-e2e`) adds `host_permissions: ["http://localhost/*"]` so tests need no permission prompt. This build MUST NOT be released. The release script refuses a manifest with `host_permissions`.

## 5. Residual risks

| Risk | Level | Notes |
|---|---|---|
| A malicious script (XSS) on an allowed origin can send print jobs. | Medium | The boundary is the origin. Mitigations: rate limit, minimal scopes, "Ask before every print". |
| Another extension's content script on the same page can forge page messages. | Low | Equivalent to page script. It cannot read the configuration. |
| Printed HTML can load images/CSS from external URLs. | Low | The site supplied that HTML itself. `img-src` is not restricted so sites can use https logos. |
| USB/serial devices receive arbitrary bytes from sites with the `print` scope. | Medium | Only devices the user granted and assigned to a profile. |
