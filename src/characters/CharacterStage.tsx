import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { motion, useMotionValue, useSpring, useAnimationControls } from 'framer-motion';
import { useStore } from '../data/store';
import { companionKey, imageKey, tierFor, type Framing, type RouteId } from './routes';
import { ParticleField, type Cue } from './effects/ParticleField';
import { Emblem } from './Emblem';
import { useSilhouette } from './useSilhouette';
import { LightPoints } from './LightPoints';
import { buildAuraSprites, type AuraSprites } from './auraSprites';
import './stage.css';

interface Props {
  route: RouteId;
  level: number;
  /** Miniaturas: sin partículas ni inclinación. */
  compact?: boolean;
  className?: string;
}

/**
 * Escenario del personaje. El aura sale de la propia silueta, precalculada una vez
 * (ya coloreada y difuminada), y solo se anima su posición y opacidad: fluido en el iPhone.
 *  1 (niv. 1–3)  aura ceñida y partículas desde el contorno
 *  2 (niv. 4–6)  aura más intensa, más partículas
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
  const [surge, setSurge] = useState(false);
  const controls = useAnimationControls();
  const figureControls = useAnimationControls();
  const sprites = useAuraSprites(compact ? undefined : src, cfg.accent, cfg.accent2, cfg.aura === 'dark');

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

  // Sacudida en los impactos fuertes.
  const onImpact = (strength: number) => {
    const d = 4 + strength * 6;
    controls.start({ x: [0, -d, d * 0.8, -d * 0.5, d * 0.3, 0], y: [0, d * 0.4, -d * 0.3, 0], transition: { duration: 0.32, ease: 'easeOut' } });
  };

  // Momentos especiales que afectan a la propia figura.
  const onCue = (cue: Cue) => {
    if (cue === 'phase') {
      // Permeación: la figura se vuelve translúcida, se hunde un poco y reaparece.
      figureControls.start({
        opacity: [1, 0.18, 0.18, 1],
        y: [0, 26, 26, 0],
        transition: { duration: 1.6, times: [0, 0.25, 0.7, 1], ease: 'easeInOut' }
      });
    } else if (cue === 'surge') {
      setSurge(true);
      window.setTimeout(() => setSurge(false), 1700);
    }
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
    '--aura-opacity': 0.5 + tier * 0.12
  } as CSSProperties;

  const maskStyle: CSSProperties | undefined = src
    ? { WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")` }
    : undefined;
  const presence = !compact && !companion && cfg.effects.includes('presence');
  const showAura = !compact && sprites;

  return (
    <div
      className={`stage motion-${cfg.motion} aura-${cfg.aura} tier-${tier} ${surge ? 'surge' : ''} ${reducedMotion ? 'reduced' : ''} ${compact ? 'compact' : ''} ${className ?? ''}`}
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
                  {presence && sprites && (
                    <div className="presence">
                      <img className="sprite presence-glow" src={sprites.wide} alt="" />
                      <img className="sprite presence-body" src={sprites.shadow} alt="" />
                    </div>
                  )}
                  {showAura && (
                    <>
                      {tier >= 3 && <img className="sprite aura backlight" src={sprites.wide} alt="" />}
                      {tier >= 3 && <img className="sprite aura outer" src={sprites.wide} alt="" />}
                      <img className="sprite aura base" src={sprites.base} alt="" />
                      {cfg.aura === 'fire' && (
                        <>
                          <img className="sprite aura flame f1" src={sprites.fire} alt="" />
                          <img className="sprite aura flame f2" src={sprites.fire} alt="" />
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
                  <motion.div className="figure-core" animate={figureControls}>
                    <img className="stage-img" src={src} alt="" draggable={false} />
                    {!compact && (cfg.sweep || tier >= 4) && (
                      <div className="stage-sweep" style={maskStyle}><span className="sweep-band" /></div>
                    )}
                    {!compact && cfg.aura === 'electric' && <div className="stage-rim" style={maskStyle} />}
                    {cfg.lights && cfg.lights.length > 0 && sil && (
                      <LightPoints lights={cfg.lights} iw={sil.iw} ih={sil.ih} />
                    )}
                  </motion.div>
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
          onCue={onCue}
        />
      )}
      {tier >= 4 && !compact && <div className="stage-layer stage-flash" />}
    </div>
  );
}

function useAuraSprites(src: string | undefined, accent: string, accent2: string, dark: boolean): AuraSprites | null {
  const [sprites, setSprites] = useState<AuraSprites | null>(null);
  useEffect(() => {
    let alive = true;
    setSprites(null);
    if (src) buildAuraSprites(src, accent, accent2, dark).then((s) => { if (alive) setSprites(s); });
    return () => { alive = false; };
  }, [src, accent, accent2, dark]);
  return sprites;
}
