import { Icon, type IconName } from './Icon';

export type Tab = 'home' | 'day' | 'stats' | 'character' | 'settings';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'day', label: 'Mi día', icon: 'day' },
  { id: 'stats', label: 'Estadísticas', icon: 'stats' },
  { id: 'character', label: 'Personaje', icon: 'character' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' }
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
        padding: '8px 6px calc(var(--safe-bottom) + 6px)',
        background: 'rgba(8,11,18,.82)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderTop: '1px solid var(--line)',
        display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))'
      }}
    >
      {TABS.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(t.id)}
            style={{
              minHeight: 50, border: 'none', background: 'none',
              color: active ? 'var(--accent)' : 'var(--faint)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontSize: 10.5, fontWeight: active ? 650 : 500, transition: 'color .2s'
            }}
          >
            <Icon name={t.icon} size={23} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
