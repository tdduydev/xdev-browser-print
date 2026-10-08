# Manual test checklist (BP-13)

Vietnamese version: [vi/MANUAL-TEST.md](vi/MANUAL-TEST.md)

Run this checklist on real machines and printers. A device is promoted to **Verified on Physical Printer** in [COMPATIBILITY.md](COMPATIBILITY.md) only with a filled record (see the end) and photos of the printout. Mock or headless results do not count.

Conventions: result is `PASS`, `FAIL` or `N/A`. A `FAIL` becomes its own bug task; do not fix code during the test run. Use the extension build under test, paired with a test page that uses the SDK.

## Setup (all groups)

- S1. Install the extension (unpacked or release zip), open the admin UI, confirm the service worker is active.
- S2. Pair a test website (https) and grant the scopes needed by the group.
- S3. Note OS, Chrome version, printer model, firmware and driver for the record.

## 1. Print dialog (device: any office printer)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| PD-01 | S1–S2, printer installed in the OS | Send an A5 HTML prescription (`print` with `paper: A5`) | Print window opens, dialog shows A5, content not clipped, margins as designed, page count correct, paper matches the preview |
| PD-02 | Same | Send an A4 PDF invoice | Dialog shows A4, all pages present, fonts embedded, paper matches |
| PD-03 | Same | Close the dialog without printing | Job ends `UNKNOWN` with `PRINT_DIALOG_CLOSED`; print window is closed |
| PD-04 | Same | Choose a printer and print | Paper comes out; job reaches a final state; no leftover window |
| PD-05 | Same | HTML containing `<script>` and a remote image | Script does not run; content is sanitized; page still prints |

## 2. `--kiosk-printing` (device: Windows machine + default printer)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| KP-01 | Chrome fully closed, default printer set | Start Chrome with `--kiosk-printing`, send PD-01 content | No dialog; prints on the default printer; record the job status the SDK reports |
| KP-02 | Same | Change the default printer, repeat | Prints on the new default printer |
| KP-03 | macOS/Linux (optional) | Repeat KP-01 | Record whether it works; the matrix currently says UNKNOWN |

## 3. WebUSB ESC/POS (device: K80 and K58 USB thermal printers)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| EP-01 | Printer on USB, driver set up for WebUSB | Pair the device from the admin UI / SDK | Device appears with vendor/product ID; permission is remembered after browser restart |
| EP-02 | EP-01, K80 | Print a K80 receipt (80 mm) | Receipt prints at full width, no truncated lines |
| EP-03 | EP-01, K58 | Print a K58 receipt (58 mm) | Fits 58 mm, no wrapping artefacts |
| EP-04 | EP-02 | Print with the cut option on | Paper is cut after the receipt |
| EP-05 | EP-02 | Print text with Vietnamese diacritics (`Phở bò, Nguyễn Thị Hương, Đà Nẵng`) | Every diacritic is correct (right code page), no `?` or garbage |
| EP-06 | EP-02 | Print a QR code and a barcode | Both scan correctly |

## 4. WebUSB ZPL/TSPL (device: label printer)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| LB-01 | Label printer paired, 50×30 mm labels loaded | Print a 50×30 mm label (ZPL or TSPL per model) | Label is aligned, nothing clipped, one label per job |
| LB-02 | LB-01 | Print a label with a barcode | Barcode scans with a handheld scanner and returns the exact value |
| LB-03 | LB-01 | Print 5 copies | Exactly 5 labels |
| LB-04 | LB-01 | Print Vietnamese text | Diacritics correct, or the limitation is recorded |

## 5. Web Serial (device: serial or USB-serial printer)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| WS-01 | Printer on a COM/serial port | Pair via Web Serial, set baud rate | Port is listed and remembered |
| WS-02 | WS-01 | Repeat EP-02, EP-04, EP-05 over serial | Same results as the WebUSB cases |
| WS-03 | WS-01, label printer | Repeat LB-01, LB-02 over serial | Same results as the WebUSB cases |
| WS-04 | WS-01 | Wrong baud rate | Output is garbage or the job fails with a clear error; record which |

## 6. Device errors

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| ER-01 | A long print job running | Unplug the USB cable mid-job | Job fails with `DEVICE_DISCONNECTED` or `TRANSFER_FAILED`; no hang; admin UI shows the error |
| ER-02 | ER-01 | Plug back in, print again | Works after re-pairing if needed; record whether re-pairing was needed |
| ER-03 | Printer cover open or no paper | Print | Record what the printer does and what the job status reports |
| ER-04 | Windows, default `usbprint.sys` driver owns the printer | Print via WebUSB | Fails with `DEVICE_BUSY`; the message points to the fix |
| ER-05 | Device not paired / removed | Print to its mapping | `DEVICE_NOT_FOUND` |

## 7. Real permissions (no printer needed)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| PM-01 | A real https site, extension installed | Pair the site | `chrome.permissions.request` prompt shows the right origin; accept → pairing works |
| PM-02 | PM-01 | Deny the prompt | Pairing fails cleanly; no host permission left behind |
| PM-03 | PM-01 | Revoke the site in the admin UI | Site can no longer print; host permission is removed |
| PM-04 | PM-01 | Print before and after the approval window expires | Behaves as in the API docs |

## Record template

Copy one per device and OS.

```
Date:
Tester:
OS + version:
Chrome version:
Extension version / commit:
Printer model:
Connection (USB / serial / network):
Firmware / driver (and WinUSB/udev used):

Case results (PASS / FAIL / N/A, with notes and bug task ID):
PD-01 .. PD-05:
KP-01 .. KP-03:
EP-01 .. EP-06:
LB-01 .. LB-04:
WS-01 .. WS-04:
ER-01 .. ER-05:
PM-01 .. PM-04:

Photos (printouts, with filename):
Verdict (promote to Verified on Physical Printer? yes/no):
```
