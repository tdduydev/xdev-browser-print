import { describe, expect, it } from 'vitest';
import { normalizeOrigin, originOfUrl, originToMatchPattern } from '../src';

const dev = { allowLocalhost: true };
const prod = { allowLocalhost: false };

describe('normalizeOrigin', () => {
  it('accepts exact https origins and canonicalizes them', () => {
    expect(normalizeOrigin('https://HIS.Example.vn/', prod)).toBe('https://his.example.vn');
    expect(normalizeOrigin('https://his.example.vn:8443', prod)).toBe('https://his.example.vn:8443');
  });

  it.each([
    ['https://*.example.vn', 'ORIGIN_NOT_ALLOWED'],
    ['*', 'ORIGIN_NOT_ALLOWED'],
    ['http://his.example.vn', 'ORIGIN_NOT_ALLOWED'],
    ['https://his.example.vn/app', 'INVALID_REQUEST'],
    ['https://his.example.vn/?x=1', 'INVALID_REQUEST'],
    ['https://user:pw@his.example.vn', 'INVALID_REQUEST'],
    ['not a url', 'INVALID_REQUEST'],
    ['file:///etc/passwd', 'ORIGIN_NOT_ALLOWED'],
    ['chrome-extension://abc', 'ORIGIN_NOT_ALLOWED'],
  ])('rejects %s', (input, code) => {
    expect(() => normalizeOrigin(input, prod)).toThrowError(expect.objectContaining({ code }));
  });

  it('allows http localhost only when the policy allows it', () => {
    expect(normalizeOrigin('http://localhost:5173', dev)).toBe('http://localhost:5173');
    expect(normalizeOrigin('http://127.0.0.1:3000', dev)).toBe('http://127.0.0.1:3000');
    expect(() => normalizeOrigin('http://localhost:5173', prod)).toThrowError(expect.objectContaining({ code: 'ORIGIN_NOT_ALLOWED' }));
  });
});

describe('originToMatchPattern', () => {
  it('drops the port because Chrome match patterns ignore it', () => {
    expect(originToMatchPattern('http://localhost:5173')).toBe('http://localhost/*');
    expect(originToMatchPattern('https://his.example.vn')).toBe('https://his.example.vn/*');
  });
});

describe('originOfUrl', () => {
  it('extracts the origin or returns null', () => {
    expect(originOfUrl('https://a.vn:444/x?y')).toBe('https://a.vn:444');
    expect(originOfUrl(undefined)).toBeNull();
    expect(originOfUrl('data:text/html,hi')).toBeNull();
  });
});
