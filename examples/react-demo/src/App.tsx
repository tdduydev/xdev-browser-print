import { useState } from 'react';
import { SDK_VERSION } from '@tdduydev/browser-print';
import { useBrowserPrint } from '@tdduydev/browser-print/react';
import { DOCUMENTS } from './documents';

const INSTALL_URL = 'https://github.com/tdduydev/xdev-browser-print/blob/main/docs/vi/INSTALL.md';
const ZIP_URL = 'https://github.com/tdduydev/xdev-browser-print/releases/latest/download/xdev-browser-print.zip';
const REPO_URL = 'https://github.com/tdduydev/xdev-browser-print';

/** Shown until the page is connected: what a visitor has to do in the extension for this exact origin. */
function Setup({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <section className="card">
      <h2 className="label">Bắt đầu</h2>
      <ol className="steps">
        <li>
          Cài tiện ích xDev Browser Print: <a href={ZIP_URL}>tải bản mới nhất (.zip)</a>, rồi làm theo{' '}
          <a href={INSTALL_URL}>hướng dẫn cài đặt</a>.
        </li>
        <li>
          Mở trang này, bấm biểu tượng tiện ích trên thanh công cụ, chọn <b>Cho phép website này</b> cho{' '}
          <code>{location.origin}</code>.
        </li>
        <li>
          Trong trang quản trị của tiện ích, thêm một máy in (ví dụ A5 qua hộp thoại in) và gán chứng từ{' '}
          <code>PRESCRIPTION</code>, <code>RECEIPT</code> hoặc <code>LABEL</code> cho máy in đó.
        </li>
        <li>Quay lại đây, bấm <b>Connect</b> rồi <b>Print</b>.</li>
      </ol>
    </section>
  );
}

export function App() {
  const { state, session, printers, error, lastJob, connect, print } = useBrowserPrint({ appName: 'React demo' });
  const [activeId, setActiveId] = useState(DOCUMENTS[0]!.id);
  const [busy, setBusy] = useState(false);
  const doc = DOCUMENTS.find((d) => d.id === activeId)!;
  const failed = lastJob?.state === 'FAILED' || lastJob?.state === 'CANCELLED';

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
    <main className="page">
      <header className="card head">
        <div className="logo" aria-hidden="true">P</div>
        <div>
          <h1>xDev Browser Print — React demo</h1>
          <p className="muted">Phòng khám Demo: in đơn thuốc, hoá đơn và tem nhãn qua xDev Browser Print</p>
          <p>
            <span className="chip mono">@tdduydev/browser-print {SDK_VERSION}</span>{' '}
            <a className="muted" href={REPO_URL}>GitHub</a>
          </p>
        </div>
      </header>

      <section className="card">
        <p data-testid="state" className={`status ${state}`}>State: {state}</p>
        {state === 'not-installed' && <p className="muted">The extension is not installed, or this origin is not allowed.</p>}
        {(state === 'ready' || state === 'error') && (
          <button className="primary" data-testid="connect" onClick={() => void connect()}>
            Connect
          </button>
        )}
        {session && (
          <>
            <p>
              Paired as <code>{session.origin}</code> (scopes: {session.scopes.join(', ')})
            </p>
            <p className="chips">
              {printers.length ? printers.map((p) => <span key={p.id} className="chip">{p.name}</span>) : <span className="muted">No printers yet</span>}
            </p>
          </>
        )}
      </section>

      <Setup connected={state === 'connected'} />

      <section className="card">
        <h2 className="label">Chứng từ</h2>
        <nav className="tabs">
          {DOCUMENTS.map((d) => (
            <button key={d.id} data-testid={`tab-${d.id}`} aria-pressed={d.id === activeId} onClick={() => setActiveId(d.id)}>
              {d.title}
            </button>
          ))}
        </nav>
        <h3>{doc.title}</h3>
        <p className="muted">{doc.description}</p>
        <button className="primary" data-testid="print" disabled={state !== 'connected' || busy} onClick={() => void onPrint()}>
          {busy ? 'Printing…' : 'Print'}
        </button>
      </section>

      <section className="card">
        <h2 className="label">Job</h2>
        {lastJob ? (
          <p data-testid="job" className={`job ${failed ? 'bad' : ''}`}>
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
          <p className="muted">No job yet.</p>
        )}
        {error && (
          <p role="alert" data-testid="error" className="error">
            {error.code}: {error.message}
          </p>
        )}
      </section>
    </main>
  );
}
