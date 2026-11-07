import type { ReactNode } from 'react';
import { useStore } from '../data/store';
import { CharacterStage } from '../characters/CharacterStage';
import { ROUTES, getRoute, imageKey } from '../characters/routes';
import { fmt, xpProgress, XP_TABLE, MAX_LEVEL } from '../characters/xp';
import { Icon, type IconName } from '../components/Icon';
import type { Tab } from '../components/BottomNav';

const today = () =>
  new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, (c) => c.toUpperCase());

export function Home({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const { settings, shownLevel, resolveLevel, images } = useStore();
  const route = getRoute(settings.activeRoute);
  const cfg = resolveLevel(route.id, shownLevel);
  const preview = settings.previewLevel !== null;
  const prog = xpProgress(settings.xp);
  const next = shownLevel < MAX_LEVEL ? resolveLevel(route.id, shownLevel + 1) : null;
  const hasAnyImage = route.levels.some((l) => images[imageKey(route.id, l.level)]);

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{today()}</span>
          <h1 className="title" style={{ fontSize: 24 }}>Hola, {settings.userName}</h1>
        </div>
        {preview && (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', padding: '6px 10px', borderRadius: 999, background: 'rgba(255,176,103,.12)', color: 'var(--warm)', border: '1px solid rgba(255,176,103,.3)' }}>
            VISTA PREVIA
          </span>
        )}
      </header>

      <section aria-label="Personaje actual" style={{ margin: '0 -20px' }}>
        <CharacterStage route={route.id} level={shownLevel} />
      </section>

      <div style={{ textAlign: 'center', marginTop: -6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: 'var(--accent)' }}>
          {route.name.toUpperCase()} · NIVEL {shownLevel}
        </span>
        <h2 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-.01em' }}>{cfg.name}</h2>
      </div>

      {settings.testMode && <TestStrip />}

      <section aria-label="Experiencia" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
          <span>
            <b style={{ color: 'var(--text)' }}>{fmt(prog.current)}</b>
            {prog.nextAt !== null ? ` / ${fmt(prog.nextAt)} XP` : ' XP · nivel máximo'}
          </span>
          {next && (
            <span>
              Próximo: <b style={{ color: 'var(--text)' }}>{next.name}</b>
            </span>
          )}
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${(preview ? 0 : prog.pct) * 100}%`, minWidth: 8, height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg, var(--accent-2), var(--accent))', boxShadow: '0 0 12px var(--accent)',
              transition: 'width .8s ease'
            }}
          />
        </div>
        {preview && (
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>
            Estás viendo el nivel {shownLevel} en vista previa. Tu XP real ({fmt(settings.xp)}) no cambia; el nivel {shownLevel} se alcanza con {fmt(XP_TABLE[shownLevel - 1])} XP.
          </span>
        )}
      </section>

      <section className="panel" aria-label="Nota del día" style={{ marginTop: 20, padding: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg width="88" height="88" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
          <circle cx="48" cy="48" r="40" fill="none" stroke="var(--accent)" strokeOpacity=".25" strokeWidth="8" strokeDasharray="3 9" />
          <text x="48" y="56" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--faint)">—</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="eyebrow">Nota de hoy</span>
          <span style={{ fontSize: 18, fontWeight: 650 }}>Tu día aún no ha empezado</span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>
            La nota aparece cuando registres algo. Nada se cuenta como cero.
          </span>
        </div>
      </section>

      <section aria-label="Indicadores de hoy" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        <Metric icon="book" color="#9fb8ff" label="Estudio" />
        <Metric icon="moon" color="#b9a6ff" label="Sueño" />
        <Metric icon="steps" color="#7fe3b8" label="Pasos" />
      </section>

      <section className="panel" aria-label="Más datos de hoy" style={{ marginTop: 12, borderRadius: 20 }}>
        <Row label="Calorías activas" />
        <Row label="Alimentación" />
        <Row label="Hábitos" />
        <Row label="Tareas" />
        <Row label="Tiempo de pantalla" value="Sin integración disponible" last />
      </section>

      <section style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        <ActionButton primary icon="play" title="Empezar a estudiar" subtitle="Temporizador · llega en la Fase 2" onClick={() => onNavigate('day')} />
        {!hasAnyImage && (
          <ActionButton icon="upload" title="Importar personajes" subtitle="Carga tus imágenes en un solo paso" onClick={() => onNavigate('settings')} />
        )}
      </section>
    </>
  );
}

/** Modo prueba: cambia de ruta y de nivel directamente desde Inicio. */
function TestStrip() {
  const { settings, update } = useStore();
  return (
    <section aria-label="Modo prueba" className="panel" style={{ marginTop: 14, padding: 12, borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {ROUTES.map((r) => (
          <button key={r.id} type="button" className="chip" aria-pressed={settings.activeRoute === r.id} onClick={() => update({ activeRoute: r.id })} style={{ flex: 1, padding: 0 }}>
            Ruta {r.number}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 6 }}>
        <button type="button" className="chip" aria-pressed={settings.previewLevel === null} onClick={() => update({ previewLevel: null })} style={{ padding: 0 }}>
          Real
        </button>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className="chip" aria-pressed={settings.previewLevel === n} onClick={() => update({ previewLevel: n })} style={{ padding: 0 }}>
            {n}
          </button>
        ))}
        <button type="button" className="chip" aria-label="Nivel siguiente" onClick={() => update({ previewLevel: ((settings.previewLevel ?? 0) % 10) + 1 })} style={{ padding: 0 }}>
          ›
        </button>
      </div>
    </section>
  );
}

function Metric({ icon, color, label }: { icon: IconName; color: string; label: string }) {
  return (
    <div className="panel" style={{ padding: '14px 12px', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Icon name={icon} size={20} color={color} />
      <span style={{ fontSize: 20, fontWeight: 650, color: 'var(--faint)' }}>—</span>
      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{label} · sin datos</span>
    </div>
  );
}

function Row({ label, value = 'Sin datos', last }: { label: string; value?: ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,.05)' }}>
      <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--faint)' }}>{value}</span>
    </div>
  );
}

function ActionButton({ icon, title, subtitle, onClick, primary }: { icon: IconName; title: string; subtitle: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={primary ? 'btn btn-primary' : 'btn'}
      style={{ minHeight: 64, justifyContent: 'flex-start', gap: 14, textAlign: 'left' }}
    >
      <Icon name={icon} size={22} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 650 }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.75 }}>{subtitle}</span>
      </span>
    </button>
  );
}
