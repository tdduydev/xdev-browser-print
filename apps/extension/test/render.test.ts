import { describe, expect, it } from 'vitest';
import { buildPrintableHtml } from '../src/print/render';

const opts = { paperSize: 'A5', orientation: 'portrait' as const, margins: { top: 8, right: 8, bottom: 8, left: 8 }, copies: 1 };

describe('buildPrintableHtml (untrusted site HTML)', () => {
  it('removes scripts, event handlers, javascript: URLs, frames and forms', () => {
    const html = buildPrintableHtml(
      `<html><head><script>alert(1)</script><link rel="stylesheet" href="https://x/y.css"><base href="https://evil/"></head>
       <body><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">x</a>
       <iframe src="https://evil"></iframe><form action="https://evil"><input name="p"></form>
       <svg><script>alert(4)</script></svg><object data="x"></object><p>Đơn thuốc</p></body></html>`,
      opts,
    );
    expect(html).not.toMatch(/<script|onerror|javascript:|<iframe|<form|<input|<object|<link|<base/i);
    expect(html).toContain('Đơn thuốc');
  });

  it('keeps site styles and adds the @page rule for the profile', () => {
    const html = buildPrintableHtml('<style>.t{color:red}</style><p class="t">x</p>', opts);
    expect(html).toContain('.t{color:red}');
    expect(html).toContain('@page { size: 148mm 210mm; margin: 8mm 8mm 8mm 8mm; }');
  });

  it('repeats the body for copies with page breaks between them', () => {
    const html = buildPrintableHtml('<p>x</p>', { ...opts, copies: 3 });
    expect(html.match(/class="xdbp-copy"/g)).toHaveLength(3);
    expect(html.match(/break-before: page/g)).toHaveLength(2);
  });
});
