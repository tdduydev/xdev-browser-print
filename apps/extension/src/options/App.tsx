import { useEffect, useState } from 'react';
import { t, type I18nKey } from '../ui/i18n';
import { useConfig } from '../ui/useBackground';
import { Dashboard } from './screens/Dashboard';
import { Devices } from './screens/Devices';
import { History } from './screens/History';
import { Mappings } from './screens/Mappings';
import { Profiles } from './screens/Profiles';
import { Settings } from './screens/Settings';
import { Sites } from './screens/Sites';
import { TestPrint } from './screens/TestPrint';

const SCREENS = ['dashboard', 'profiles', 'mappings', 'devices', 'test', 'history', 'sites', 'settings'] as const;
type Screen = (typeof SCREENS)[number];

function initialScreen(): Screen {
  const h = location.hash.slice(1) as Screen;
  return SCREENS.includes(h) ? h : 'dashboard';
}

export function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const { data, error, reload } = useConfig();

  useEffect(() => {
    history.replaceState(null, '', `#${screen}`);
  }, [screen]);

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <img src="/icons/icon-32.png" width={24} height={24} alt="" />
          {t('app.name')}
        </div>
        {SCREENS.map((s) => (
          <button key={s} className={s === screen ? 'active' : ''} onClick={() => setScreen(s)} data-testid={`nav-${s}`}>
            {t(`nav.${s}` as I18nKey)}
          </button>
        ))}
      </nav>
      <main className="content">
        {error && <div className="notice error">{error}</div>}
        {!data ? (
          <p className="muted">…</p>
        ) : (
          <>
            {screen === 'dashboard' && <Dashboard />}
            {screen === 'profiles' && <Profiles config={data.config} />}
            {screen === 'mappings' && <Mappings config={data.config} />}
            {screen === 'devices' && <Devices />}
            {screen === 'test' && <TestPrint config={data.config} />}
            {screen === 'history' && <History config={data.config} />}
            {screen === 'sites' && <Sites sites={data.sites} config={data.config} />}
            {screen === 'settings' && <Settings config={data.config} onSaved={reload} />}
          </>
        )}
      </main>
    </div>
  );
}
