import { useState } from 'react';
import { useStore } from '../data/store';
import { CharacterStage } from '../characters/CharacterStage';
import { LevelUpOverlay } from '../characters/LevelUpOverlay';
import { getRoute, tierFor } from '../characters/routes';
import { fmt, XP_TABLE, MAX_LEVEL } from '../characters/xp';
import { Icon } from '../components/Icon';

const TIER_LABEL = ['', 'Básico', 'Avanzado', 'Épico', 'Legendario'];

export function CharacterScreen() {
  const { settings, shownLevel, resolveLevel } = useStore();
  const route = getRoute(settings.activeRoute);
  const [playing, setPlaying] = useState<number | null>(null);
  const next = shownLevel < MAX_LEVEL ? resolveLevel(route.id, shownLevel + 1) : null;

  return (
    <>
      <span className="eyebrow">{route.name}</span>
      <h1 className="title">{resolveLevel(route.id, shownLevel).name}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 16 }}>
        <Stat label="Nivel" value={`${shownLevel} / ${MAX_LEVEL}`} />
        <Stat label="XP" value={fmt(settings.xp)} />
        <Stat label="Rango" value={TIER_LABEL[tierFor(shownLevel)]} />
      </div>

      {shownLevel >= MAX_LEVEL && (
        <div
          className="panel"
          style={{
            marginTop: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12,
            borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
            background: 'linear-gradient(120deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)'
          }}
        >
          <Icon name="sparkle" size={24} color="var(--accent)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', color: 'var(--accent)' }}>RUTA COMPLETADA</span>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Has desbloqueado los 10 niveles de {route.name}.</span>
          </div>
        </div>
      )}

      {next && (
        <div className="panel" style={{ marginTop: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="lock" size={20} color="var(--accent)" />
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
            Próximo desbloqueo: <b style={{ color: 'var(--text)' }}>{next.name}</b> con {fmt(XP_TABLE[next.level - 1])} XP
          </span>
        </div>
      )}

      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '26px 0 12px' }}>Galería de la ruta</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
        {route.levels.map((l) => {
          const unlocked = l.level <= shownLevel;
          const cfg = resolveLevel(route.id, l.level);
          return (
            <button
              key={l.level}
              type="button"
              disabled={!unlocked}
              onClick={() => setPlaying(l.level)}
              aria-label={unlocked ? `${cfg.name}, ver animación de desbloqueo` : `Nivel ${l.level} bloqueado`}
              className="panel"
              style={{ padding: 0, overflow: 'hidden', borderRadius: 20, textAlign: 'left', position: 'relative', opacity: unlocked ? 1 : 0.55 }}
            >
              <div style={{ height: 170, position: 'relative', filter: unlocked ? 'none' : 'grayscale(1) brightness(.35)' }}>
                <CharacterStage route={route.id} level={l.level} compact />
              </div>
              {!unlocked && (
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <Icon name="lock" size={18} color="#c9d0dd" />
                </div>
              )}
              <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: unlocked ? cfg.accent : 'var(--faint)' }}>
                  NIVEL {l.level}
                </span>
                <span style={{ fontSize: 14, fontWeight: 650 }}>{unlocked ? cfg.name : '???'}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{fmt(XP_TABLE[l.level - 1])} XP</span>
              </div>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 14, lineHeight: 1.5 }}>
        Toca un nivel desbloqueado para volver a ver su animación. Los niveles nunca se pierden.
      </p>

      <LevelUpOverlay open={playing !== null} route={route.id} level={playing ?? 1} onClose={() => setPlaying(null)} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel" style={{ padding: '12px 12px', borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
