import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBrowserPrint } from '../src/react';
import { FakeBridge, FakeWindow, ORIGIN, job } from './fake-bridge';

describe('useBrowserPrint', () => {
  it('detects, connects, loads printers and prints', async () => {
    const win = new FakeWindow();
    new FakeBridge(win)
      .on('connect', () => ({ extensionId: 'ext-1', extensionVersion: '0.1.0', protocolVersion: 1, origin: ORIGIN, scopes: ['read', 'print'] }))
      .on('getPrinters', () => [{ id: 'printer-a5', name: 'A5', adapter: 'browser', category: 'A5', paperSize: 'A5', isDefault: true, status: { ready: true } }])
      .on('print', () => ({ jobId: 'job_1', state: 'QUEUED', duplicate: false }))
      .on('getJobStatus', () => job({ state: 'SUBMITTED' }));
    const { result } = renderHook(() => useBrowserPrint({ target: win as unknown as Window, detectTimeoutMs: 50 }));
    expect(result.current.state).toBe('detecting');
    await waitFor(() => expect(result.current.state).toBe('ready'));
    await act(() => result.current.connect());
    expect(result.current.state).toBe('connected');
    expect(result.current.printers.map((p) => p.id)).toEqual(['printer-a5']);
    await act(async () => {
      await result.current.print({ documentType: 'PRESCRIPTION', format: 'HTML', data: '<p>x</p>' });
    });
    expect(result.current.lastJob?.state).toBe('SUBMITTED');
  });

  it('reports not-installed', async () => {
    const { result } = renderHook(() => useBrowserPrint({ target: new FakeWindow() as unknown as Window, detectTimeoutMs: 20 }));
    await waitFor(() => expect(result.current.state).toBe('not-installed'));
  });
});
