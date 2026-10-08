# Testing — xDev Browser Print

Vietnamese version: [vi/TESTING.md](vi/TESTING.md)

Run date: 2026-10-08 · Machine: macOS 27.0.1 · Node 26.10.0 · pnpm 10.34.6 · Chromium 156 (Playwright 1.64.0, build 1248, headless)

## 1. Results

| Level | Tool | Tests | Result |
|---|---|---|---|
| Unit — core | Vitest 3.2.7 (node) | 70 | 70 passed |
| Unit + integration — extension | Vitest 3.2.7 (jsdom) | 54 | 54 passed |
| Unit + integration — SDK | Vitest 3.2.7 (jsdom) | 18 | 18 passed |
| E2E — real extension in Chromium | Playwright 1.64.0 | 19 | 19 passed |
| Lint | ESLint 9.39.5 | — | 0 errors |
| Typecheck (test files included) | TypeScript 5.9.3 strict | — | 0 errors |

Test-suite sanity check: two bugs were injected on purpose (rate limit removed; `DISPATCHING` jobs resent after a restart). The suite reported 3 failures in the right places. After reverting, everything passed.

Coverage is not measured yet (`@vitest/coverage-v8` not installed).

CI runs the same suites on every pull request and push to `main` (`.github/workflows/ci.yml`). First CI run (37777305750, PR #2): lint + typecheck, unit tests on Ubuntu/Windows/macOS, build + package, and e2e on `ubuntu-latest` all passed.

## 2. How to run

```bash
pnpm install
pnpm exec playwright install chromium   # first time
pnpm lint
pnpm typecheck
pnpm test        # unit + integration (142 tests)
pnpm test:e2e    # builds the SDK and the e2e extension, then runs Playwright (19 tests)
```

## 3. Scope per level

| Level | Covers | Does not cover |
|---|---|---|
| Unit | Pure logic in `packages/core`: origins, configuration, router, state machine, rate limit, replay, encoders. | Chrome APIs. |
| Integration | `JobManager` + `MemoryJobStore` + fake adapters. `PageApi` + `ConfigStore` + `JobManager`. WebUSB/Serial adapters with fake devices. SDK + fake bridge. | Real Chrome, real devices. |
| E2E | The built extension in Chromium: service worker, content script, IndexedDB, `chrome.storage`, print window, approval window, admin UI. | The real print dialog (headless), physical printers, real WebUSB/Serial. |

## 4. Test cases by feature

### 4.1 Website security

| ID | Case | Expected | File |
|---|---|---|---|
| SEC-01 | Wildcard origin, path, query, credentials, `file:`, `chrome-extension:` | Rejected with the right code | `core/test/origin.test.ts` |
| SEC-02 | `http://localhost` with `allowLocalhost` off | `ORIGIN_NOT_ALLOWED` | `core/test/origin.test.ts` |
| SEC-03 | A never-allowed origin opens the page | `isInstalled() = false` (no content script) | e2e |
| SEC-04 | Same host, different port | `ORIGIN_NOT_ALLOWED` from the service worker | e2e |
| SEC-05 | Look-alike origins: `his.example.vn.evil.com`, `http://` instead of `https://` | `ORIGIN_NOT_ALLOWED` | `extension/test/page-api.test.ts` |
| SEC-06 | `read`-only site calls `print`, `saveMapping` | `PERMISSION_DENIED` | unit + e2e |
| SEC-07 | `configure` scope with `allowSiteConfigure` off | `PERMISSION_DENIED` | `page-api.test.ts` |
| SEC-08 | `connect()` asks for more scopes → approval window → Deny | Old scopes kept | e2e |
| SEC-09 | `connect()` asks for more scopes → Allow | Grant includes the new scope | e2e |
| SEC-10 | Unpaired origin denied | `PAIRING_REJECTED` | `page-api.test.ts` |
| SEC-11 | Invented scope (`admin`) | Ignored | `page-api.test.ts` |
| SEC-12 | Reused `requestId`; `sentAt` 5 min off | `REPLAY_DETECTED` | unit |
| SEC-13 | Malformed request, unknown method | `INVALID_REQUEST`, no crash | `page-api.test.ts` |
| SEC-14 | Site B reads or cancels site A's job | `JOB_NOT_FOUND` | `page-api.test.ts` |
| SEC-15 | Internal error containing patient data | Response does not contain it | `page-api.test.ts` |
| SEC-16 | `getPrinters()` | No `vendorId`, `serialNumber`, `baudRate` | `page-api.test.ts` |
| SEC-17 | Site revoked while the page is open | Next request rejected | e2e |
| SEC-18 | HTML with `script`, `onerror`, `javascript:`, `iframe`, `form`, `svg/script`, `object`, `link`, `base` | Removed; Vietnamese content kept | `render.test.ts` + e2e |
| SEC-19 | Print iframe | `sandbox="allow-same-origin allow-modals"`, no `script` | e2e |
| SEC-20 | Messages to the SDK from another origin or window | Ignored | `sdk/test/client.test.ts` |
| SEC-21 | `extensionId` pinned, another extension answers | Ignored | `sdk/test/client.test.ts` |

### 4.2 Jobs, duplicates, spam

| ID | Case | Expected | File |
|---|---|---|---|
| JOB-01 | ESC/POS through a mapping | `SUBMITTED`, all 5 states recorded, mapping `copies` applied | `job-manager.test.ts` |
| JOB-02 | Print through the dialog | `UNKNOWN` + `PRINT_DIALOG_CLOSED` | unit + e2e |
| JOB-03 | Same `idempotencyKey` again | Existing job returned, `duplicate: true`, adapter called once | unit + e2e |
| JOB-04 | Two concurrent requests with the same key | One succeeds, one `REPLAY_DETECTED` | `job-manager.test.ts` |
| JOB-05 | Same key, different origin | Two separate jobs | `job-manager.test.ts` |
| JOB-06 | Rate limit exceeded | `RATE_LIMITED`; other origins unaffected | unit + e2e |
| JOB-07 | Payload over `maxJobBytes` | `PAYLOAD_TOO_LARGE`, no job created | `job-manager.test.ts` |
| JOB-08 | Non-PDF bytes labelled PDF | `INVALID_REQUEST` | unit + e2e |
| JOB-09 | Unmapped document type | `MAPPING_NOT_FOUND`, history records `FAILED` | unit + e2e |
| JOB-10 | ZPL to a `browser` printer; PDF to a `webusb` printer | `UNSUPPORTED_FORMAT` | unit + e2e |
| JOB-11 | Retryable error (no byte sent), then success | `SUBMITTED`, `attempts = 2` | `job-manager.test.ts` |
| JOB-12 | Retryable error every time | `FAILED` after `maxAttempts` | `job-manager.test.ts` |
| JOB-13 | Partial transfer | `FAILED` + `PARTIAL_TRANSFER`, no retry | `job-manager.test.ts` |
| JOB-14 | Adapter hangs past the timeout | `UNKNOWN` + `DISPATCH_TIMEOUT`, no retry | `job-manager.test.ts` |
| JOB-15 | 3 jobs on one printer | Run one at a time | `job-manager.test.ts` |
| JOB-16 | Confirmation required; user denies / approves | `CANCELLED` / `SUBMITTED` | `job-manager.test.ts` |
| JOB-17 | Cancel a `WAITING_PERMISSION` job; cancel a finished job | `CANCELLED` / `INVALID_REQUEST` | `job-manager.test.ts` |
| JOB-18 | History over `historyLimit` | Only the configured number kept | `job-manager.test.ts` |
| JOB-19 | Print history | No document content (unit: payload deleted; e2e: patient name absent from data and UI) | unit + e2e |
| JOB-20 | Site has "Ask before every print" on; approve, deny, or close the approval window | Job waits in `WAITING_PERMISSION` with no print window; approve → exactly one print window, `UNKNOWN`/`PRINT_DIALOG_CLOSED`; deny or close → `CANCELLED`/`USER_DENIED`, SDK error `PERMISSION_DENIED`, no print window | e2e |

### 4.3 Service worker stop / extension restart

| ID | Case | Expected | File |
|---|---|---|---|
| SW-01 | Restart with one job `DISPATCHING` and another `QUEUED` | Job 1 → `UNKNOWN` (not resent); job 2 is sent | `job-manager.test.ts` |
| SW-02 | Restart while the print window is open | Job stays `DISPATCHING`; the window's result is applied; a second late report is ignored | `job-manager.test.ts` |
| SW-03 | Real worker stopped via CDP `ServiceWorker.stopAllWorkers` | A new worker starts (in-memory marker gone); the next request succeeds | e2e |
| SW-04 | SDK misses events | SDK polls every 2 s and gets the result | `client.test.ts` |
| SW-05 | Real worker stopped via CDP while the per-job approval window is open; then Allow is clicked on the stale window | New worker cancels the job (`CANCELLED`/`INTERRUPTED_BY_RESTART`, SDK error `JOB_CANCELLED`); the late Allow has no effect; no print window opens | e2e |

### 4.4 USB / Serial (fake devices)

| ID | Case | Expected |
|---|---|---|
| DEV-01 | Device with a vendor interface and a printer interface | Picks class 7; sends 16 KB chunks; releases + closes |
| DEV-02 | No granted device | `DEVICE_NOT_FOUND`, retryable |
| DEV-03 | Serial number mismatch | `DEVICE_NOT_FOUND` |
| DEV-04 | `claimInterface` fails (OS driver owns it) | `DEVICE_BUSY`, still closes |
| DEV-05 | USB unplugged mid-transfer | `PARTIAL_TRANSFER`, no retry, `bytesWritten = 16384` |
| DEV-06 | USB unplugged before the first byte | `DEVICE_DISCONNECTED`, retryable |
| DEV-07 | Stalled transfer | `TIMEOUT` |
| DEV-08 | No WebUSB | `UNSUPPORTED_CAPABILITY` |
| DEV-09 | Serial: open with the profile's settings, write, close | `SUBMITTED` + `BYTES_WRITTEN_TO_PORT` |
| DEV-10 | Serial port already open elsewhere | `DEVICE_BUSY` |
| DEV-11 | Serial error while writing | `PARTIAL_TRANSFER`, no retry, port closed |
| DEV-12 | Port selection by USB ids and index | Right port |
| DEV-13 | `copies`, auto cut, `ascii` Vietnamese encoding | Data repeated; `GS V` added once; diacritics removed |

File: `apps/extension/test/adapters.test.ts`. These use fake devices, so they prove the **Implemented** level only.

### 4.5 Admin UI (e2e)

| ID | Case | Expected |
|---|---|---|
| UI-01 | Open the options page | "Tổng quan" heading (Vietnamese by default); all 8 navigation items work |
| UI-02 | Create an A5 profile and map `PRESCRIPTION` through the UI | Tables show the profile and mapping; configuration saved |
| UI-03 | Manifest | MV3, module service worker, no static `content_scripts` |
| UI-04 | Tick "Ask before every print" for an existing site on the Sites screen | Checkbox shows ticked; `confirmEachJob = true` saved in the site grant; the next job opens the approval window | e2e |

## 5. Not tested yet

| Item | Reason | Task |
|---|---|---|
| Real print dialog, printer selection, paper output | Headless Chromium shows no print dialog | BP-13 (manual) |
| `--kiosk-printing` | Needs headed Chrome and a real printer | BP-13 |
| WebUSB/Web Serial with real printers (K80, K58, label) | No devices in CI | BP-13 |
| Windows e2e | Unit tests pass on Windows in CI; browser e2e runs on Linux (CI) and macOS (local) only | BP-12 |
| Real `chrome.permissions.request` prompt | Playwright cannot click Chrome's prompt; the e2e build pre-grants localhost | BP-13 |
| Extension popup | No e2e yet | BP-10 |
| Coverage | Tool not installed | BP-10 |
