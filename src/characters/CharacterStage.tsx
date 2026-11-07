import { useId, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { motion, useMotionValue, useSpring, useAnimationControls } from 'framer-motion';
import { useStore } from '../data/store';
import { companionKey, imageKey, tierFor, type Framing, type RouteId } from './routes';
import { ParticleField } from './effects/ParticleField';
import { Emblem } from './Emblem';
import { useSilhouette } from './useSilhouette';
import { LightPoints } from './LightPoints';
import './stage.css';

interface Props {
  route: RouteId;
  level: number;
  /** Miniaturas: sin partículas ni inclinación. */
  compact?: boolean;
  className?: string;
}

/**
 * Escenario del personaje. Todo lo que rodea a la figura sale de su propia silueta
 * (aura, contraluz, distorsión, partículas, rayos): luz y materia, no dibujos.
 * La espectacularidad escala por "tiers":
 *  1 (niv. 1–3)  aura ceñida a la silueta y partículas desde el contorno
 *  2 (niv. 4–6)  aura más intensa y densa, más partículas
 *  3 (niv. 7–9)  + contraluz detrás de la figura, segunda capa de aura, inclinación 3D
 *  4 (niv. 10)   + destellos periódicos y todo al máximo
 */
export function CharacterStage({ route, level, compact, className }: Props) {
  const { images, resolveLevel, reducedMotion } = useStore();
  const cfg = resolveLevel(route, level);
  const src = images[imageKey(route, level)];
  const companion = images[companionKey(route, level)];
  const sil = useSilhouette(compact ? undefined : src);
  const tier = tierFor(level);
  const intensity = 0.45 + level * 0.11;
  const [burst, setBurst] = useState(0);
  const controls = useAnimationControls();
  const hazeId = `lp-haze-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const { zoom, focusX, focusY } = cfg.framing;
  const framing = useMemo<Framing>(() => ({ zoom, focusX, focusY }), [zoom, focusX, focusY]);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 120, damping: 14 });
  const sry = useSpring(ry, { stiffness: 120, damping: 14 });
  const tilt = tier >= 3 && !reducedMotion && !compact;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };

  // Sacudida en los impactos fuertes (chispazo negro, tajos, pisotones).
  const onImpact = (strength: number) => {
    const d = 4 + strength * 6;
    controls.start({ x: [0, -d, d * 0.8, -d * 0.5, d * 0.3, 0], y: [0, d * 0.4, -d * 0.3, 0], transition: { duration: 0.32, ease: 'easeOut' } });
  };

  const onTap = () => {
    if (compact || reducedMotion) return;
    setBurst((b) => b + 1);
    controls.start({ scale: [1, 1.04 + tier * 0.01, 1], transition: { duration: 0.5, ease: 'easeOut' } });
    if (tier >= 3) navigator.vibrate?.(12);
  };

  const vars = {
    '--lv-accent': cfg.accent,
    '--lv-accent2': cfg.accent2,
    '--aura-size': 66 + tier * 8,
    '--aura-strength': 14 + tier * 7,
    '--amp': 0.5 + tier * 0.15,
    '--aura-blur': `${(5 + tier * 3) / Math.max(1, zoom)}px`,
    '--aura-opacity': 0.45 + tier * 0.11
  } as CSSProperties;

  const maskStyle: CSSProperties | undefined = src
    ? { WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")` }
    : undefined;

  // Distorsión por calor / energía (fuego y auras oscuras) desde el nivel 2 de espectacularidad.
  const haze = !compact && !reducedMotion && (cfg.aura === 'fire' || cfg.aura === 'dark');
  const hazeFilter = haze ? `url(#${hazeId}) blur(var(--aura-blur))` : undefined;
  const presence = !compact && !companion && cfg.effects.includes('presence');

  return (
    <div
      className={`stage motion-${cfg.motion} aura-${cfg.aura} tier-${tier} ${reducedMotion ? 'reduced' : ''} ${compact ? 'compact' : ''} ${className ?? ''}`}
      style={vars}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerUp={onLeave}
      onClick={onTap}
      role="img"
      aria-label={`${cfg.name}, nivel ${level}`}
    >
      {haze && (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <filter id={hazeId} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.042" numOctaves="2" seed="4" result="noise">
              <animate attributeName="baseFrequency" dur="7s" values="0.011 0.042;0.015 0.058;0.011 0.042" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={cfg.aura === 'fire' ? 26 : 34} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}

      <div className="stage-layer">
        {tier >= 4 && <div className="stage-aura second" />}
        <div className="stage-aura" />
      </div>

      <motion.div className="stage-figure" style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }} animate={controls}>
        {!compact && companion && (
          <div className="companion">
            <img src={companion} alt="" draggable={false} />
          </div>
        )}
        <div className="m-bob">
          <div className="m-sway">
            {src ? (
              <div className="stage-crop">
                <div className="stage-zoom" style={{ transform: `scale(${zoom})`, transformOrigin: `${focusX}% ${focusY}%` }}>
                  {presence && (
                    <div className="presence">
                      <div className="presence-glow"><div className="aura-mask" style={maskStyle} /></div>
                      <div className="presence-body" style={hazeFilter ? { filter: `url(#${hazeId}) blur(3px)` } : undefined}>
                        <div className="aura-mask" style={maskStyle} />
                      </div>
                    </div>
                  )}
                  {!compact && (
                    <>
                      {tier >= 3 && (
                        <div className="aura-wrap backlight">
                          <div className="aura-mask" style={maskStyle} />
                        </div>
                      )}
                      {tier >= 3 && (
                        <div className="aura-wrap outer">
                          <div className="aura-mask" style={maskStyle} />
                        </div>
                      )}
                      <div className="aura-wrap base" style={cfg.aura === 'dark' && hazeFilter ? { filter: hazeFilter } : undefined}>
                        <div className="aura-mask" style={maskStyle} />
                      </div>
                      {cfg.aura === 'fire' && (
                        <>
                          <div className="aura-wrap flame f1" style={hazeFilter ? { filter: hazeFilter } : undefined}>
                            <div className="aura-mask" style={maskStyle} />
                          </div>
                          <div className="aura-wrap flame f2" style={hazeFilter ? { filter: hazeFilter } : undefined}>
                            <div className="aura-mask" style={maskStyle} />
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {!compact && cfg.effects.includes('afterimage') && (
                    <>
                      <img className="stage-img ghost g1" src={src} alt="" draggable={false} />
                      <img className="stage-img ghost g2" src={src} alt="" draggable={false} />
                    </>
                  )}
                  <img className="stage-img" src={src} alt="" draggable={false} />
                  {!compact && (cfg.sweep || tier >= 4) && (
                    <div className="stage-sweep" style={maskStyle} />
                  )}
                  {!compact && cfg.aura === 'electric' && (
                    <div className="stage-rim" style={maskStyle} />
                  )}
                  {cfg.lights && cfg.lights.length > 0 && sil && (
                    <LightPoints lights={cfg.lights} iw={sil.iw} ih={sil.ih} />
                  )}
                </div>
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <Emblem accent={cfg.accent} level={level} />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {!compact && !reducedMotion && (
        <ParticleField
          effects={cfg.effects}
          accent={cfg.accent}
          accent2={cfg.accent2}
          intensity={intensity}
          silhouette={sil}
          framing={framing}
          burstKey={burst}
          onImpact={onImpact}
        />
      )}
      {tier >= 4 && !compact && <div className="stage-layer stage-flash" />}
    </div>
  );
}
