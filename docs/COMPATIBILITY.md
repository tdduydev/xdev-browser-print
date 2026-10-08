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
| Extension install, service worker, admin UI | Verified on Browser (Chromium 156 headless, e2e) | Implemented | Implemented |
| Website pairing, scopes, approval window, revoke | Verified on Browser (e2e) | Implemented | Implemented |
| Replay, duplicate and rate-limit protection | Verified on Browser (e2e) | Implemented | Implemented |
| Service worker restart | Verified on Browser (e2e, CDP stop) | Implemented | Implemented |
| HTML → print window (sanitized, sandboxed) | Verified on Browser (headless; no dialog shown) | Implemented | Implemented |
| PDF → print window | Verified on Browser (headless; job reaches a final state) | Implemented | Implemented |
| Chrome print dialog, printer selection | Not tested | Not tested | Not tested |
| Dialog-free printing via `--kiosk-printing` | UNKNOWN (a vendor reports it is unsupported) | Documented by third parties, not tested | UNKNOWN |
| WebUSB → ESC/POS (K80/K58) | Implemented | Implemented (usually needs the WinUSB driver) | Implemented (needs a udev rule, `usblp` unbound) |
| WebUSB → ZPL/TSPL (labels) | Implemented | Implemented | Implemented |
| Web Serial → ESC/POS/ZPL/TSPL | Implemented | Implemented | Implemented |

The Linux column moves to **Verified on Browser** for e2e-covered rows once the CI e2e job passes on `ubuntu-latest`.

## Verified devices

No device has reached **Verified on Physical Printer** yet.

## OS notes (not yet verified on real machines)

| OS | Notes |
|---|---|
| Windows | The `usbprint.sys` driver usually owns the USB printer interface, so `claimInterface` fails → `DEVICE_BUSY`. A common fix is installing WinUSB for the device (e.g. with Zadig). The printer then stops working through the Windows driver. |
| Linux | Needs udev permissions for the device and the `usblp` driver unbound from the interface. |
| macOS | The OS may claim some devices. Test per model. |
