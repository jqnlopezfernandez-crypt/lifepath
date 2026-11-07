import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../data/store';
import { CharacterStage } from './CharacterStage';
import { getRoute, tierFor, type RouteId } from './routes';
import { fmt, XP_TABLE } from './xp';

interface Props {
  open: boolean;
  route: RouteId;
  level: number;
  onClose: () => void;
}

/** Animación de desbloqueo. Más larga y potente cuanto mayor es el nivel. */
export function LevelUpOverlay({ open, route, level, onClose }: Props) {
  const { resolveLevel, reducedMotion } = useStore();
  const cfg = resolveLevel(route, level);
  const tier = tierFor(level);
  const slow = 1 + (tier - 1) * 0.25; // los niveles altos se toman su tiempo
  const rings = 1 + tier + (level === 10 ? 3 : 0);
  const theme = getRoute(route).number;

  // Portal al <body> para que el overlay cubra toda la pantalla aunque el contenedor tenga transformaciones.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Nivel ${level} desbloqueado`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, overflow: 'hidden',
            background: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${cfg.accent} 22%, #05070c) 0%, #05070c 70%)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 'calc(env(safe-area-inset-top) + 20px) 20px calc(env(safe-area-inset-bottom) + 28px)'
          }}
        >
          {/* Entrada propia de cada ruta */}
          {!reducedMotion && theme === 1 && <StarkIntro accent={cfg.accent} slow={slow} />}
          {!reducedMotion && theme === 2 && <ShadowIntro accent={cfg.accent} slow={slow} />}
          {!reducedMotion && theme === 3 && <BurstIntro accent={cfg.accent} accent2={cfg.accent2} slow={slow} />}

          {/* Anillos de energía que se expanden */}
          {!reducedMotion &&
            Array.from({ length: rings }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.2, opacity: 0.9 }}
                animate={{ scale: 3.2, opacity: 0 }}
                transition={{ duration: 1.4 * slow, delay: 0.15 + i * 0.22, ease: 'easeOut' }}
                style={{
                  position: 'absolute', top: '42%', left: '50%', width: 220, height: 220, marginLeft: -110, marginTop: -110,
                  borderRadius: '50%', border: `${2 + tier}px solid ${i % 2 ? cfg.accent2 : cfg.accent}`,
                  boxShadow: `0 0 40px ${cfg.accent}`, pointerEvents: 'none'
                }}
              />
            ))}

          <motion.span
            initial={{ opacity: 0, y: -10, letterSpacing: '0.6em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.24em' }}
            transition={{ delay: 0.3 * slow, duration: 0.6 }}
            style={{ fontSize: 12, fontWeight: 700, color: cfg.accent, textTransform: 'uppercase', zIndex: 1 }}
          >
            {level === 10 ? 'Ruta completada' : 'Nuevo nivel desbloqueado'}
          </motion.span>

          <motion.div
            initial={{ scale: 0.6, opacity: 0, filter: 'brightness(3)' }}
            animate={{ scale: 1, opacity: 1, filter: 'brightness(1)' }}
            transition={{ delay: 0.45 * slow, duration: 0.9 * slow, type: 'spring', bounce: 0.25 + tier * 0.05 }}
            style={{ width: '100%', maxWidth: 420, height: 'min(52vh, 440px)', zIndex: 1 }}
          >
            <CharacterStage route={route} level={level} className="fill" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 * slow, duration: 0.5 }}
            style={{ textAlign: 'center', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <span style={{ fontSize: 14, color: '#9aa3b5', fontWeight: 600 }}>NIVEL {level}</span>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em', textShadow: `0 0 24px ${cfg.accent}` }}>{cfg.name}</span>
            <span style={{ fontSize: 14, color: '#c9d0dd' }}>{fmt(XP_TABLE[level - 1])} XP acumulada</span>
          </motion.div>

          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 2 * slow }}
            style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 24px)', fontSize: 13, color: '#9aa3b5' }}
          >
            Toca para continuar
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

const full = { position: 'absolute', inset: 0, pointerEvents: 'none' } as const;

/** Ruta Stark: interfaz holográfica que se ensambla alrededor del personaje. */
function StarkIntro({ accent, slow }: { accent: string; slow: number }) {
  const line = `2px solid ${accent}`;
  const corner = (x: 'left' | 'right', y: 'top' | 'bottom', i: number) => (
    <motion.div
      key={x + y}
      initial={{ opacity: 0, scale: 1.6 }}
      animate={{ opacity: [0, 1, 1, 0.5], scale: 1 }}
      transition={{ duration: 0.7 * slow, delay: 0.05 * i, ease: 'easeOut' }}
      style={{
        position: 'absolute', width: 46, height: 46, pointerEvents: 'none',
        left: x === 'left' ? '12%' : undefined,
        right: x === 'right' ? '12%' : undefined,
        top: y === 'top' ? '18%' : undefined,
        bottom: y === 'bottom' ? '18%' : undefined,
        borderLeft: x === 'left' ? line : undefined,
        borderRight: x === 'right' ? line : undefined,
        borderTop: y === 'top' ? line : undefined,
        borderBottom: y === 'bottom' ? line : undefined,
        boxShadow: `0 0 12px ${accent}`
      }}
    />
  );
  return (
    <div style={full}>
      <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} style={{ ...full, background: accent }} />
      {corner('left', 'top', 0)}
      {corner('right', 'top', 1)}
      {corner('left', 'bottom', 2)}
      {corner('right', 'bottom', 3)}
      {[0.32, 0.5, 0.68].map((t, i) => (
        <motion.div
          key={t}
          initial={{ scaleX: 0, opacity: 0.9 }}
          animate={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.9 * slow, delay: 0.15 + i * 0.12, ease: 'easeOut' }}
          style={{ position: 'absolute', left: '8%', right: '8%', top: `${t * 100}%`, height: 1, background: accent, transformOrigin: i % 2 ? 'right' : 'left', pointerEvents: 'none' }}
        />
      ))}
      <motion.div
        initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
        animate={{ rotate: 180, scale: 1.1, opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.4 * slow, ease: 'easeOut' }}
        style={{ position: 'absolute', top: '42%', left: '50%', width: 300, height: 300, margin: '-150px 0 0 -150px', borderRadius: '50%', border: `2px dashed ${accent}`, pointerEvents: 'none' }}
      />
    </div>
  );
}

/** Ruta Jujutsu: la oscuridad se expande desde el centro y luego se abre. */
function ShadowIntro({ accent, slow }: { accent: string; slow: number }) {
  return (
    <div style={full}>
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 4, 4], opacity: [1, 1, 0] }}
        transition={{ duration: 1.1 * slow, times: [0, 0.45, 1], ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '42%', left: '50%', width: 300, height: 300, margin: '-150px 0 0 -150px', borderRadius: '50%', background: '#000', boxShadow: `0 0 60px 10px ${accent}`, pointerEvents: 'none' }}
      />
      <motion.div
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 3.5, opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.2 * slow, delay: 0.45 * slow, ease: 'easeOut' }}
        style={{ position: 'absolute', top: '42%', left: '50%', width: 220, height: 220, margin: '-110px 0 0 -110px', borderRadius: '50%', border: `3px solid ${accent}`, pointerEvents: 'none' }}
      />
    </div>
  );
}

/** Ruta Héroes: estallido de energía con líneas radiales y destello. */
function BurstIntro({ accent, accent2, slow }: { accent: string; accent2: string; slow: number }) {
  return (
    <div style={full}>
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 * slow }} style={{ ...full, background: '#fff' }} />
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.8 * slow, delay: 0.05 + (i % 3) * 0.06, ease: 'easeOut' }}
          style={{
            position: 'absolute', top: '42%', left: '50%', width: '75vmax', height: i % 2 ? 2 : 4, marginTop: -1,
            background: `linear-gradient(90deg, ${i % 2 ? accent2 : accent}, transparent)`,
            transformOrigin: '0 50%', rotate: `${(i / 18) * 360}deg`, pointerEvents: 'none'
          }}
        />
      ))}
    </div>
  );
}
