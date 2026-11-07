import { useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { motion, useMotionValue, useSpring, useAnimationControls } from 'framer-motion';
import { useStore } from '../data/store';
import { imageKey, tierFor, type Framing, type RouteId } from './routes';
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
 * (aura, reflejos, partículas, rayos), así cada imagen tiene efectos que encajan con ella.
 * La espectacularidad escala por "tiers":
 *  1 (niv. 1–3)  aura ceñida a la silueta, movimiento propio, partículas desde el contorno
 *  2 (niv. 4–6)  + rayos de luz detrás, aura más intensa, más partículas
 *  3 (niv. 7–9)  + halo de energía, ondas en el suelo, segunda capa de aura, inclinación 3D
 *  4 (niv. 10)   + doble halo, destellos periódicos y todo al máximo
 */
export function CharacterStage({ route, level, compact, className }: Props) {
  const { images, resolveLevel, reducedMotion } = useStore();
  const cfg = resolveLevel(route, level);
  const src = images[imageKey(route, level)];
  const sil = useSilhouette(compact ? undefined : src);
  const tier = tierFor(level);
  const intensity = 0.45 + level * 0.11;
  const [burst, setBurst] = useState(0);
  const controls = useAnimationControls();

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
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 14);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };

  // Sacudida en los impactos fuertes (chispazo negro, tajos, golpe en el suelo).
  const onImpact = (strength: number) => {
    const d = 4 + strength * 6;
    controls.start({ x: [0, -d, d * 0.8, -d * 0.5, d * 0.3, 0], y: [0, d * 0.4, -d * 0.3, 0], transition: { duration: 0.32, ease: 'easeOut' } });
  };

  const onTap = () => {
    if (compact || reducedMotion) return;
    setBurst((b) => b + 1);
    controls.start({ scale: [1, 1.05 + tier * 0.012, 1], transition: { duration: 0.5, ease: 'easeOut' } });
    if (tier >= 3) navigator.vibrate?.(12);
  };

  const vars = {
    '--lv-accent': cfg.accent,
    '--lv-accent2': cfg.accent2,
    '--aura-size': 70 + tier * 10,
    '--aura-strength': 18 + tier * 8,
    '--rays-opacity': tier >= 2 ? 0.3 + (tier - 2) * 0.18 : 0,
    '--amp': 0.6 + tier * 0.2,
    '--aura-blur': `${(5 + tier * 3) / Math.max(1, zoom)}px`,
    '--aura-opacity': 0.5 + tier * 0.1
  } as CSSProperties;

  const maskStyle: CSSProperties | undefined = src
    ? { WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")` }
    : undefined;

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
      <div className="stage-layer">
        {tier >= 4 && <div className="stage-aura second" />}
        <div className="stage-aura" />
        {tier >= 2 && <div className="stage-rays" />}
        {tier >= 3 && <div className="stage-halo" />}
        {tier >= 4 && <div className="stage-halo dashed" />}
        <div className="stage-ground" />
        {tier >= 3 && (
          <>
            <div className="stage-wave" />
            <div className="stage-wave w2" />
          </>
        )}
      </div>

      <motion.div className="stage-figure" style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }} animate={controls}>
        <div className="m-bob">
          <div className="m-sway">
            {src ? (
              <div className="stage-crop">
                <div className="stage-zoom" style={{ transform: `scale(${zoom})`, transformOrigin: `${focusX}% ${focusY}%` }}>
                  {!compact && (
                    <>
                      {tier >= 3 && (
                        <div className="aura-wrap outer">
                          <div className="aura-mask" style={maskStyle} />
                        </div>
                      )}
                      <div className="aura-wrap base">
                        <div className="aura-mask" style={maskStyle} />
                      </div>
                      {cfg.aura === 'fire' && (
                        <>
                          <div className="aura-wrap flame f1"><div className="aura-mask" style={maskStyle} /></div>
                          <div className="aura-wrap flame f2"><div className="aura-mask" style={maskStyle} /></div>
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
