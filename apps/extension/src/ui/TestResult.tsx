import { t } from './i18n';
import type { TestState } from './useTestPrint';

export function TestResult({ state }: { state: TestState | null }) {
  if (!state) return null;
  if (state.phase === 'running') {
    return (
      <div className="notice" role="status" data-testid="test-msg">
        {state.jobId ? t('test.waiting', { jobId: state.jobId }) : t('test.sending')}
      </div>
    );
  }
  return (
    <div className={`notice ${state.ok ? 'ok' : 'error'}`} role="status" data-testid="test-msg">
      {state.text}
    </div>
  );
}
