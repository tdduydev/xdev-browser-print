# Phase 2 design — xDev Browser Print

Vietnamese version: [vi/PHASE-2.md](vi/PHASE-2.md)

Updated: 2026-10-08.

## Context and goals

Phase 2 moves xDev Browser Print from "Implemented" to "Verified": more automated tests, verification on real printers, then a release of the SDK and the extension.

State of v0.1.0 (after PR #2):

- Extension (MV3), SDK `@xdev/browser-print`, `packages/core` and `packages/shared-types` exist; lint, typecheck and unit tests pass on Ubuntu, Windows and macOS.
- Playwright e2e runs only on Linux (CI) and macOS (local). Windows has no e2e.
- No device has reached "Verified on Physical Printer" (`docs/COMPATIBILITY.md`).
- `docs/TESTING.md` section 5 lists the gaps: popup, `confirmEachJob`, coverage (BP-10), Windows e2e (BP-12), the real print dialog, `--kiosk-printing`, real WebUSB/Serial, the real permission prompt (BP-13).
- `release.yml` creates a GitHub Release and can submit to the Chrome Web Store, but does not publish the SDK to npm.

Phase 2 goals:

1. Every gap in TESTING.md section 5 that can be automated has a test running in CI.
2. At least one thermal printer (K80) and one A5 print-dialog flow reach "Verified on Physical Printer".
3. A v0.2.0 release: the SDK on npm and the extension submitted for Chrome Web Store review.

## Scope

Phase 2 adds no new printing features; it verifies and releases what v0.1.0 already has.

| In scope | Out of scope |
| --- | --- |
| Automated tests for popup, `confirmEachJob`, coverage, Windows/macOS e2e | New print formats, new adapters (Bluetooth, LAN) |
| Checklist and test records on real printers | Automating Chrome's print dialog (Chrome does not allow it) |
| WinUSB and udev setup guide | Browsers other than Chrome/Chromium (Edge only noted if it works) |
| Publishing the SDK to npm, Chrome Web Store submission | Native app, backend, cloud print |
| React example app, repo docs for agents | Changes to the SDK ↔ extension protocol |

## Automated testing (T2–T6)

This group reuses the existing Playwright fixture (`tests/e2e/fixtures.ts`: persistent Chromium context, the `dist-e2e` build with `http://localhost/*` pre-granted) and does not change extension code unless a test exposes a bug.

### T2 — Coverage

- Add `@vitest/coverage-v8` and a `coverage` block in the vitest config: `include` is `packages/*/src` and `apps/extension/src`, excluding UI `*.tsx` (covered by e2e).
- Script `pnpm test:coverage`; the Ubuntu unit job runs it and uploads `coverage/` as an artifact.
- Thresholds: measure once, set `thresholds` to the measured values rounded down to 5 points. The goal is to stop regressions, not to chase a number.

### T3 — Popup e2e

- Open `chrome-extension://<id>/popup.html` in a normal tab. The popup needs the active tab, so the test opens the site page first and then the popup with a tab parameter, or stubs `chrome.tabs.query` via `page.addInitScript` if the popup takes no parameter.
- Cases: unpaired `http://localhost` page → pair button; paired page → scopes and revoke button; `chrome://` or non-localhost `http://` page → `popup.unsupportedPage` message.
- Add the case IDs to `docs/TESTING.md` (and `docs/vi`).

### T4 — `confirmEachJob` e2e

- `confirmEachJob` is a flag on each site grant (`apps/extension/src/background/sites.ts`). The test turns it on through the admin UI Sites page, not by writing storage directly.
- Cases: send a job → approval window opens → approve → job continues; reject → SDK gets the right error code; close the window without answering → job ends as `docs/ARCHITECTURE.md` specifies.
- Also check: stopping the service worker while the approval window is open does not print the job twice.

### T5 — Windows e2e

- Turn the `e2e` job in `ci.yml` into a matrix `os: [ubuntu-latest, windows-latest]`.
- Known risk: `build:e2e` uses `XDBP_E2E=1 vite build`, which does not run in pnpm's default shell on Windows. Fix with `cross-env` or read the flag through Vite's `--mode e2e`.
- Check paths in `fixtures.ts`: `normalize` + `startsWith(dir)` must hold with `\` separators on Windows.
- Update the Windows column in `docs/COMPATIBILITY.md` when CI is green, with the run number.

### T6 — macOS e2e in CI

- Add `macos-latest` to the T5 matrix. If run time or macOS runner cost is too high, run it only on pushes to `main` and on tags, not on every PR.

## Real devices (T7–T9)

A device is promoted to "Verified on Physical Printer" only with a test record that follows the T7 checklist, with photos of the printout.

### T7 — BP-13 checklist

Create `docs/MANUAL-TEST.md` and `docs/vi/MANUAL-TEST.md`. Each case has an ID, preconditions, steps and expected result. Case groups:

| Group | Example cases | Device needed |
| --- | --- | --- |
| Print dialog | A5 HTML prescription, A4 PDF invoice: paper size, margins, page count correct; job ends `UNKNOWN` + `PRINT_DIALOG_CLOSED` | Any office printer |
| `--kiosk-printing` | Chrome started with this flag prints straight to the default printer, no dialog | Windows machine + default printer |
| WebUSB ESC/POS | Pair the device, print K80 and K58 receipts, paper cut, Vietnamese diacritics in the right code page | K80/K58 USB thermal printer |
| WebUSB ZPL/TSPL | 50×30 mm label, barcode scans | Label printer |
| Web Serial | The cases above over a COM/serial port | Printer with serial or USB-serial |
| Device errors | Unplug while printing, out of paper, device claimed by the OS driver (`DEVICE_BUSY`) | As above |
| Real permissions | `chrome.permissions.request` prompt when pairing a real https site | No printer needed |

The file ends with a record template: date, tester, OS and Chrome version, printer model, firmware/driver, result per case, photos. `docs/COMPATIBILITY.md` gets a "Verified devices" table for the results.

### T8 — Run BP-13 on real printers

- Someone with the devices runs the T7 checklist on at least Windows 11 and one other OS.
- Each bug found becomes its own Hive task linked to T8; T8 does not fix code itself.
- Results and photos go into `docs/COMPATIBILITY.md` through a PR.

### T9 — Driver and device permission guide

- `docs/DEVICE-SETUP.md` (+ vi): Windows — install WinUSB with Zadig, state clearly that the printer then stops printing through the Windows driver, and how to undo it; Linux — udev rule by `idVendor`/`idProduct`, unbind `usblp`; macOS — record what T8 finds.
- Include a sample `scripts/udev/99-xdev-printer.rules`.
- The admin UI (Devices page) links to this guide on `DEVICE_BUSY`.
- Only write steps that T8 confirmed; mark the rest "not yet verified".

## Release (T10–T11)

One `vX.Y.Z` tag releases the extension and the SDK at the same version; every outward step goes through a GitHub environment with a reviewer.

### T10 — Publish the SDK to npm

- `packages/browser-print-sdk/package.json` is `"license": "UNLICENSED"`. To decide: publish publicly on npmjs (change the license; the `@xdev` scope must belong to the team) or privately on GitHub Packages.
- `release.yml`: add an `npm-publish` job after `release`, using an `npm` environment holding `NPM_TOKEN`; check SDK version = extension version = tag; `npm publish --provenance --access <public|restricted>`.
- The SDK imports `@xdev/shared-types`: check whether tsup bundles it or it must be published too — `dist/*.d.ts` must not import `@xdev/shared-types`; if it does, enable `dts.resolve` or publish that package as well.
- Add `npm pack --dry-run` to CI to catch packaging errors early.

### T11 — First Chrome Web Store submission

- An administrator creates the item in the Developer Dashboard (the first upload is manual), gets `CWS_EXTENSION_ID`, creates the OAuth client and refresh token, adds the 4 secrets to the `chrome-web-store` environment, and turns on required reviewers.
- The agent drafts: the store description (EN + vi), a justification for each permission (`storage`, `scripting`, `activeTab`, `optional_host_permissions`, WebUSB, Web Serial), the privacy policy (print data never leaves the machine), screenshots of the admin UI.
- Decide visibility: Unlisted (only customers with the link) or Public. Proposed default: Unlisted for v0.2.0.
- Done when the item is "Pending review"; approval is Google's and does not block the task.

## Example app and repo docs (T12, T1)

### T12 — React example app

- `examples/react-demo`: Vite + React, using `@xdev/browser-print/react` (`useBrowserPrint`) through `workspace:*`.
- Three screens for three document types: A5 prescription (HTML → print dialog), K80 receipt (ESC/POS), 50×30 mm label (ZPL). Each shows the job status and the error code the SDK returns.
- The e2e test page is the hand-written `tests/e2e/site/index.html`. Keep it in this phase; only add one e2e smoke test for the demo (builds, pairs, sends one HTML job).
- The demo doubles as integration docs for customers: its README points to `docs/API.md`.

### T1 — Repo docs for agents

- The end of `AGENTS.md` is still the placeholder "Mô tả ngắn dự án…". Per Hive rules, do not edit it directly: `doc_get`, then `doc_propose` with `baseVersion`.
- Content: a one-paragraph description; the `pnpm lint`, `typecheck`, `test`, `test:e2e`, `build`, `package` commands; the `apps/` and `packages/` layout; conventions: docs always have EN + `docs/vi`, never promote a level in COMPATIBILITY.md on mocks alone, the e2e build is `dist-e2e` with localhost pre-granted.
- Record gotchas in Hive with `memory_write` (for example: PDF/HTML jobs always end `UNKNOWN`).

## Order, dependencies and risks

Eight tasks have no dependencies and can be assigned in parallel now; T8 needs someone with printers and blocks T9 and T11.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| No person or device for T8 | T9, T11 and goal 2 blocked | Name the person and the printer models as soon as T7 is assigned |
| WinUSB takes the printer away from the Windows driver | Customers cannot print from other applications | T9 states the trade-off and how to undo it; consider Web Serial or the print dialog for shared printers |
| Flaky Windows/macOS e2e (slow service worker start) | False red CI, reviewers start ignoring it | Mark flaky tests, keep `retries` at 1 at most |
| macOS runner cost | CI minutes | T6 runs only on `main` and tags |
| SDK imports `@xdev/shared-types`, which is not published | Broken TypeScript types for customers | T10 checks `dist/*.d.ts` and runs `npm pack --dry-run` |
| Chrome Web Store rejects broad permissions (`https://*/*`) | Release delay | Already `optional_host_permissions`; T11 justifies each permission in the submission form |

![Dependencies between the 12 tasks](images/phase-2-dependencies.png)

Every task in the "Bước 1" (step 1) column can be assigned now; T8 is work for someone with printers and unblocks T9 and T11.

## Task cards for Hive

One row per task. The Hive description reads "Design: section `T<n>` in `docs/PHASE-2.md`" plus the description column below. Set dependencies with `dependsOn` when creating.

| ID | Title | Description | Kind | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| T1 | Complete AGENTS.md for the repo | Replace the placeholder with description, commands, layout, conventions; submit via `doc_propose` | AI | — | Proposal approved in Hive |
| T2 | Measure coverage in CI (BP-10a) | `@vitest/coverage-v8`, `pnpm test:coverage`, artifact, thresholds at current level | AI | — | CI has a coverage artifact and enforces thresholds |
| T3 | Popup e2e (BP-10b) | Unpaired, paired + revoke, unsupported page | AI | — | New tests green in CI, TESTING.md updated |
| T4 | `confirmEachJob` e2e (BP-10c) | Approve, reject, close window, stop service worker | AI | — | New tests green in CI, TESTING.md updated |
| T5 | Windows e2e (BP-12) | e2e matrix, fix `build:e2e` with `cross-env`, check paths | AI | — | Windows e2e green, COMPATIBILITY.md cites the run |
| T6 | macOS e2e in CI | Add `macos-latest` to the matrix, possibly only on `main` and tags | AI | T5 | macOS e2e green in CI |
| T7 | BP-13 manual test checklist | `docs/MANUAL-TEST.md` (EN + vi), record template, Verified devices table | AI | — | Docs merged |
| T8 | Run BP-13 on real printers | K80/K58, label printer, A4/A5 print dialog; each bug becomes a new task | Human | T7 | At least 1 device "Verified on Physical Printer" |
| T9 | Driver and device permission guide | `docs/DEVICE-SETUP.md` (EN + vi), sample udev rule, link from the Devices page | AI | T8 | Docs merged, confirmed by the T8 tester |
| T10 | Publish the SDK to npm | Decide registry and license, `npm-publish` job with provenance, check `shared-types` is bundled | AI + Human | — | `npm pack --dry-run` green in CI; a test tag publishes |
| T11 | First Chrome Web Store submission | Human creates the item and secrets; agent drafts description, permission justifications, privacy policy, screenshots | Human + AI | T8 | Item is Pending review |
| T12 | React example app | `examples/react-demo` with A5 prescription, K80 receipt, ZPL label, e2e smoke test | AI | — | Runs, smoke test green, README has instructions |
