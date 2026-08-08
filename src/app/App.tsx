import { useEffect, useState } from 'react';
import { TabBar, type TabId } from '../components/TabBar';
import { TodayScreen } from '../features/today/TodayScreen';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { InsightsScreen } from '../features/insights/InsightsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { BrowseScreen } from '../features/browse/BrowseScreen';
import { CycleScreen } from '../features/cycle/CycleScreen';
import { db, ensureSeedData } from '../db/schema';
import { useLiveQuery } from '../db/useLiveQuery';

type Overlay = 'browse' | 'cycle' | null;

export function App() {
  const [tab, setTab] = useState<TabId>('today');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [ready, setReady] = useState(false);
  const settings = useLiveQuery(() => db.settings.get('singleton'), []);

  useEffect(() => {
    ensureSeedData().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme === 'system' ? '' : settings.theme;
  }, [settings?.theme]);

  if (!ready) return null;

  if (overlay === 'browse') {
    return <BrowseScreen onBack={() => setOverlay(null)} />;
  }
  if (overlay === 'cycle') {
    return <CycleScreen onBack={() => setOverlay(null)} />;
  }

  return (
    <>
      {tab === 'today' && <TodayScreen />}
      {tab === 'calendar' && <CalendarScreen />}
      {tab === 'insights' && (
        <InsightsScreen
          onOpenBrowse={() => setOverlay('browse')}
          onOpenCycle={() => setOverlay('cycle')}
          cycleTrackingEnabled={settings?.cycleTrackingEnabled ?? false}
        />
      )}
      {tab === 'settings' && <SettingsScreen />}
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}
