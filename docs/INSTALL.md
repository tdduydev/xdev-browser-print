# Installing the extension

The extension is submitted to the Chrome Web Store (unlisted) and waits for Google's review. Until the store link works, or on machines that must not wait for it, install the release build by hand.

## From the Chrome Web Store

When the listing is approved: open https://xdev.asia/browser-print/ and click **Add to Chrome**. Chrome updates it automatically.

## Manual install (release build)

Requires Google Chrome 118 or later on Windows 10/11, macOS or Linux.

1. Download the latest build: https://github.com/tdduydev/xdev-browser-print/releases/latest/download/xdev-browser-print.zip
   (every version: https://github.com/tdduydev/xdev-browser-print/releases).
2. Unzip it into a folder that stays on the computer, for example `Documents/xdev-browser-print`. Chrome loads the extension from this folder every time it starts: do not delete or move it.
3. Open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder (the one that contains `manifest.json`).
5. Pin **xDev Browser Print** from the puzzle icon in the toolbar, open its options page, and set up printer profiles, document mappings and the websites allowed to print.

Optional check: compare the ZIP with the `.sha256` file of the same version on the release page (`shasum -a 256 <file>.zip` on macOS/Linux, `certutil -hashfile <file>.zip SHA256` on Windows).

### What is different from the store version

- **No automatic updates.** To update, download the new ZIP, replace the files in the same folder, then click the reload icon on the extension card in `chrome://extensions`. Settings are kept because the folder (and so the extension ID) stays the same.
- **A different extension ID.** A manual install and the store install are separate extensions with separate settings. Web apps using the SDK still find either one, because the SDK talks to whichever extension the page has, without a fixed ID.
- Chrome may show a notice about extensions in developer mode. Some managed (company) Chrome installations block developer mode; ask the administrator to allow the extension by policy instead.

### Moving to the store version later

1. Install from the Chrome Web Store.
2. Set up printer profiles, mappings and allowed websites again (export is not available yet).
3. Remove the manually installed copy in `chrome://extensions`, so the two do not both answer the same website.
