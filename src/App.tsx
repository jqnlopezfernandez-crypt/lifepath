import { useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav, type Tab } from './components/BottomNav';
import { useStore } from './data/store';
import { Home } from './screens/Home';
import { CharacterScreen } from './screens/CharacterScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ComingSoon } from './screens/ComingSoon';

export function App() {
  const { ready, settings, shownLevel, resolveLevel, reducedMotion } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  // El color de acento de toda la app sigue al personaje actual.
  const accent = resolveLevel(settings.activeRoute, shownLevel).accent;

  if (!ready) return <div className="app" />;

  return (
    <div className={`app route-${settings.activeRoute} ${reducedMotion ? 'still' : ''}`} style={{ '--accent': accent } as CSSProperties}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="screen"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {tab === 'home' && <Home onNavigate={setTab} />}
          {tab === 'day' && (
            <ComingSoon
              title="Mi día"
              text="Temporizador de estudio, valoración de alimentación, hábitos y tareas. Llega en la Fase 2."
            />
          )}
          {tab === 'stats' && (
            <ComingSoon
              title="Estadísticas"
              text="Resúmenes semanales y mensuales con datos reales. Llega cuando haya registros (Fase 6)."
            />
          )}
          {tab === 'character' && <CharacterScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </motion.div>
      </AnimatePresence>
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}
