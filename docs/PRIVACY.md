# Privacy policy — xDev Browser Print

Vietnamese version: [vi/PRIVACY.md](vi/PRIVACY.md)

Effective date: `<effective date>`

This policy covers the xDev Browser Print Chrome extension ("the extension"). It describes what the extension does with data, as implemented in its source code at https://github.com/tdduydev/xdev-browser-print.

## Summary

- Documents you print are processed **on your computer only** and go only to your printer.
- The extension makes **no network requests** of its own. It has no server, no account, no analytics, no advertising and no tracking.
- Print history keeps **metadata only**, never the content of a document.
- Nothing is sold, shared or transferred to anyone.

## What the extension handles

### Documents sent for printing

Web applications that you (or your administrator) have explicitly allowed can send documents to the extension for printing: PDF, HTML, or raw printer commands (ESC/POS, ZPL, TSPL). These documents can contain personal, health or financial information, for example prescriptions or invoices.

- The document is kept in the extension's local database (IndexedDB) only while the print job is in progress, and is **deleted as soon as the job ends** (sent, failed, cancelled, or the print dialog closed).
- The document is sent only to the printer you configured: through Chrome's print dialog, or directly to a USB or serial printer that you granted to the extension.
- HTML documents are printed as the web application wrote them. If that HTML refers to images or stylesheets on the internet, Chrome loads them from the addresses the web application chose, as any web page would. The extension adds no data to those requests.

### Configuration

Stored in Chrome's local extension storage (`chrome.storage.local`) on your computer, never synchronised to your Google account:

- Printer profiles: name, paper size, margins, orientation, number of copies, connection type and, for USB/serial printers, the device's vendor ID, product ID and USB serial number, and serial port settings.
- Which printer is used for each document type.
- Settings (language, size and rate limits, history length).
- The list of web applications you allowed, by exact address, with the permissions you gave each one.

While you are allowing a new website, its address is kept for up to 5 minutes in Chrome's session storage, which Chrome clears when the browser closes.

### Print history

For each print job the extension keeps: job ID, the requesting website's address, document type, format, size in bytes, number of copies, printer profile, status, result, error code and message, number of attempts and timestamps. It **does not keep the document content**.

History is stored in the extension's local database and limited to the newest 500 jobs by default (adjustable from 10 to 5000 in Settings). You can delete it at any time with "Clear history".

### Current tab address

When you open the extension's toolbar popup, it reads the address of the current tab to show whether that website is allowed to print. The address is not stored unless you then allow that website.

### USB and serial devices

The extension can only use USB or serial devices that you select yourself in Chrome's device chooser on the Devices screen. You can remove that access there at any time.

## What the extension does not do

- It does not send any data to the developer or to any third party.
- It does not use analytics, telemetry, crash reporting, cookies or advertising.
- It does not read web pages, browsing history, passwords or form data.
- It has no access to any website until you allow that website, and then only to that one website.
- It does not log print data.

## Where data is kept and how to delete it

All data stays in your Chrome profile on your computer. To delete it:

- Remove a website in the extension's Websites screen, or remove the extension's site access in `chrome://extensions`.
- Delete printer profiles in the Printers screen, and history with "Clear history".
- Remove the extension. Chrome then deletes the extension's local storage and database **[Unverified: Chrome's behaviour, not part of the extension's code]**.

## Children

The extension is a business tool for printing documents and is not directed at children.

## Changes to this policy

Changes are published in this file in the repository. The history of the file shows every change and its date.

## Contact

`<contact email>`
