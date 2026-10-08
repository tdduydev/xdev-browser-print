import { useState } from 'react';
import { useBrowserPrint } from '@tdduydev/browser-print/react';
import { DOCUMENTS } from './documents';

export function App() {
  const { state, session, printers, error, lastJob, connect, print } = useBrowserPrint({ appName: 'React demo' });
  const [activeId, setActiveId] = useState(DOCUMENTS[0]!.id);
  const [busy, setBusy] = useState(false);
  const doc = DOCUMENTS.find((d) => d.id === activeId)!;

  const onPrint = async () => {
    setBusy(true);
    try {
      await print({ ...doc.options, idempotencyKey: `${doc.id}-${Date.now()}` });
    } catch {
      // The hook already keeps the error and the job; swallow the rethrow so it is not an unhandled rejection.
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 720, margin: '2rem auto' }}>
      <h1>xDev Browser Print — React demo</h1>
      <p data-testid="state">State: {state}</p>
      {state === 'not-installed' && <p>The extension is not installed, or this origin is not allowed.</p>}
      {(state === 'ready' || state === 'error') && (
        <button data-testid="connect" onClick={() => void connect()}>
          Connect
        </button>
      )}
      {session && (
        <p>
          Paired as {session.origin} (scopes: {session.scopes.join(', ')}). Printers: {printers.map((p) => p.name).join(', ') || 'none'}
        </p>
      )}

      <nav>
        {DOCUMENTS.map((d) => (
          <button key={d.id} data-testid={`tab-${d.id}`} aria-pressed={d.id === activeId} onClick={() => setActiveId(d.id)}>
            {d.title}
          </button>
        ))}
      </nav>
      <section>
        <h2>{doc.title}</h2>
        <p>{doc.description}</p>
        <button data-testid="print" disabled={state !== 'connected' || busy} onClick={() => void onPrint()}>
          {busy ? 'Printing…' : 'Print'}
        </button>
      </section>

      <section>
        <h3>Job</h3>
        {lastJob ? (
          <p data-testid="job">
            {lastJob.documentType} — <b data-testid="job-state">{lastJob.state}</b>
            {lastJob.outcome && (
              <>
                {' / '}
                <span data-testid="job-outcome">{lastJob.outcome}</span>
              </>
            )}
            {lastJob.errorCode && (
              <>
                {' / '}
                <span data-testid="job-error">{lastJob.errorCode}</span>
              </>
            )}
          </p>
        ) : (
          <p>No job yet.</p>
        )}
        {error && (
          <p role="alert" data-testid="error">
            {error.code}: {error.message}
          </p>
        )}
      </section>
    </main>
  );
}
