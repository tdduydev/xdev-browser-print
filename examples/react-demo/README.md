# React demo — xDev Browser Print

Tiếng Việt: [README.vi.md](README.vi.md)

A small Vite + React app that prints through the extension with the `useBrowserPrint` hook from `@tdduydev/browser-print/react`. Use it as a working integration example; the full SDK reference is [docs/API.md](../../docs/API.md).

## What it shows

| Screen | `documentType` | Format | Expected result |
|---|---|---|---|
| Prescription (A5) | `PRESCRIPTION` | `HTML` | Chrome's print dialog opens. The job ends `UNKNOWN` / `PRINT_DIALOG_CLOSED`, because Chrome does not report whether the user printed. |
| Receipt (K80) | `RECEIPT` | `ESCPOS` | Raw bytes to a thermal printer over WebUSB/Web Serial. `SUBMITTED` means every byte was written. |
| Label (50×30 mm) | `LABEL` | `ZPL` | Raw ZPL to a label printer. |

Each screen shows the extension state (`detecting`, `not-installed`, `ready`, `connected`, `error`), the paired origin and its scopes, the printers, the last job's state and outcome, and the SDK error code if a call fails.

Source: `src/App.tsx` (hook usage), `src/documents.ts` (sample documents).

## Run it

```bash
# 1. From the repo root
pnpm install
pnpm build                              # builds apps/extension/dist and packages/browser-print-sdk/dist

# 2. Start the demo on http://localhost:5174 (fixed port: the extension pairs with an exact origin)
pnpm --filter @xdev/react-demo dev
```

The demo imports the built SDK (`packages/browser-print-sdk/dist`). Rebuild it with `pnpm --filter @tdduydev/browser-print build` after changing the SDK.

## Set up the extension

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and pick `apps/extension/dist`.
2. Open the extension's options page:
   - **Printers**: add a profile. For the prescription, an A5 profile with the `browser` adapter is enough.
   - **Document mapping**: map `PRESCRIPTION` (and `RECEIPT`, `LABEL` if you have those printers) to a profile.
   - **Websites**: allow `http://localhost:5174` with the **Read configuration** and **Print** permissions. Chrome asks you to grant access to the site.
   - **Settings**: keep **Allow localhost (development)** on.
3. Reload the demo, click **Connect**, pick a document and click **Print**.

Without step 2 the demo shows `not-installed` (no bridge for this origin), or a `MAPPING_NOT_FOUND` error when printing an unmapped document type.

## Build and test

```bash
pnpm --filter @xdev/react-demo build    # examples/react-demo/dist
pnpm test:e2e                           # includes tests/e2e/react-demo.spec.ts: builds the demo, pairs, prints one HTML job
```
