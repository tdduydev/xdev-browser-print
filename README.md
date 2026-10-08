# xDev Browser Print

[![CI](https://github.com/tdduydev/xdev-browser-print/actions/workflows/ci.yml/badge.svg)](https://github.com/tdduydev/xdev-browser-print/actions/workflows/ci.yml)

A Chrome Extension (Manifest V3) and TypeScript SDK that let ReactJS web apps print prescriptions, invoices and labels to printers configured per document type. No backend, native app or cloud print service.

Tiếng Việt: [docs/vi](docs/vi/ARCHITECTURE.md)

| Path | Contents |
|---|---|
| `apps/extension` | Extension: service worker, content script, admin UI, print window |
| `packages/browser-print-sdk` | SDK `@xdev/browser-print` and the `useBrowserPrint` hook |
| `packages/core` | Shared logic: origins, configuration, router, job states, encoders |
| `packages/shared-types` | Types and protocol |
| `tests/e2e` | Playwright e2e on real Chromium |
| `docs` | Design documents |

## Commands

```bash
pnpm install
pnpm lint && pnpm typecheck
pnpm test          # unit + integration
pnpm test:e2e      # e2e (first time: pnpm exec playwright install chromium)
pnpm build         # apps/extension/dist + packages/browser-print-sdk/dist
pnpm check:sdk-package # npm pack --dry-run + SDK checks (after build)
pnpm package       # release/xdev-browser-print-<version>.zip
```

Try the extension: open `chrome://extensions`, enable Developer mode, click **Load unpacked** → `apps/extension/dist`.

## CI/CD

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | Push to `main`, pull requests | Lint, typecheck; unit tests on Ubuntu/Windows/macOS; build + release ZIP artifact; Playwright e2e |
| `release.yml` | Tag `v*.*.*` | Checks SDK/extension/tag versions, builds and verifies the SDK tarball, creates a GitHub Release, then publishes the SDK through the npm environment (skipped until the SDK license is approved) and uploads to the Chrome Web Store |

Chrome Web Store upload runs only when the `chrome-web-store` environment has the secrets `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID` (Chrome Web Store API V2). A successful upload means the item was **submitted for review**, not published.

SDK publication setup and pending registry/license decisions: [EN](docs/SDK-RELEASE.md) / [VI](docs/vi/SDK-RELEASE.md).

## Documents

- [Feature design](docs/ARCHITECTURE.md)
- [SDK API](docs/API.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Compatibility matrix](docs/COMPATIBILITY.md)
- [Phase 2 design and task plan](docs/PHASE-2.md)

## Key limitations

- Chrome on Windows/macOS/Linux does not let extensions list or select OS printers. PDF/HTML always go through the print dialog.
- Chrome does not report whether the user printed or cancelled. PDF/HTML jobs end in `UNKNOWN` + `PRINT_DIALOG_CLOSED`.
- Dialog-free printing exists only for printers that accept RAW commands over WebUSB/Web Serial, or when an administrator starts Chrome with `--kiosk-printing`.
