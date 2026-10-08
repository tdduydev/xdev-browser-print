# Compatibility matrix

Vietnamese version: [vi/COMPATIBILITY.md](vi/COMPATIBILITY.md)

Levels:

- **Implemented**: code exists and is tested with mocks / fake devices.
- **Verified on Browser**: works on real Chrome/Chromium (automated or manual).
- **Verified on Physical Printer**: printed on paper with a real printer.

No feature is promoted on the basis of mock tests alone.

Updated: 2026-10-08.

## Features × operating systems

| Feature | macOS | Windows 10/11 | Linux |
|---|---|---|---|
| Extension install, service worker, admin UI | Verified on Browser (Chromium 156 headless, e2e, local) | Implemented (unit tests pass in CI) | Verified on Browser (CI e2e, `ubuntu-latest`) |
| Website pairing, scopes, approval window, revoke | Verified on Browser (e2e) | Implemented | Verified on Browser (CI e2e) |
| Replay, duplicate and rate-limit protection | Verified on Browser (e2e) | Implemented | Verified on Browser (CI e2e) |
| Service worker restart | Verified on Browser (e2e, CDP stop) | Implemented | Verified on Browser (CI e2e) |
| HTML → print window (sanitized, sandboxed) | Verified on Browser (headless; no dialog shown) | Implemented | Verified on Browser (CI e2e, headless) |
| PDF → print window | Verified on Browser (headless; job reaches a final state) | Implemented | Verified on Browser (CI e2e, headless) |
| Chrome print dialog, printer selection | Not tested | Not tested | Not tested |
| Dialog-free printing via `--kiosk-printing` | UNKNOWN (a vendor reports it is unsupported) | Documented by third parties, not tested | UNKNOWN |
| WebUSB → ESC/POS (K80/K58) | Implemented | Implemented (usually needs the WinUSB driver) | Implemented (needs a udev rule, `usblp` unbound) |
| WebUSB → ZPL/TSPL (labels) | Implemented | Implemented | Implemented |
| Web Serial → ESC/POS/ZPL/TSPL | Implemented | Implemented | Implemented |

Linux results come from CI run 37777305750 (PR #2, 2026-10-08). Windows has unit tests in CI but no browser e2e yet.

## Verified devices

No device has reached **Verified on Physical Printer** yet.

## OS notes (not yet verified on real machines)

| OS | Notes |
|---|---|
| Windows | The `usbprint.sys` driver usually owns the USB printer interface, so `claimInterface` fails → `DEVICE_BUSY`. A common fix is installing WinUSB for the device (e.g. with Zadig). The printer then stops working through the Windows driver. |
| Linux | Needs udev permissions for the device and the `usblp` driver unbound from the interface. |
| macOS | The OS may claim some devices. Test per model. |
