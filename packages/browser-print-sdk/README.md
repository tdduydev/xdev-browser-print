# @tdduydev/browser-print

TypeScript SDK for printing through the xDev Browser Print Chrome extension.
The extension must be installed and your web origin must be approved before connecting.

```sh
npm install @tdduydev/browser-print
# For the optional React hook:
npm install react
```

The package provides ESM, CommonJS and bundled TypeScript declarations. React 18 or
later is an optional peer dependency, required only for `@tdduydev/browser-print/react`.
Internal workspace packages are bundled; they do not need to be installed separately.

See the [SDK API](https://github.com/tdduydev/xdev-browser-print/blob/main/docs/API.md)
and [Vietnamese API guide](https://github.com/tdduydev/xdev-browser-print/blob/main/docs/vi/API.md)
for connection, printer selection, print jobs, errors and React examples.

PDF/HTML printing uses Chrome's print dialog. Chrome cannot report whether the user
printed or cancelled, and cannot list or select operating system printers.
