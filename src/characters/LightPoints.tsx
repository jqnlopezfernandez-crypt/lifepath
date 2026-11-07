import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LightPoint } from './silhouette';

/**
 * Brillos animados sobre puntos concretos de la imagen (ojos, núcleos de energía…).
 * Va dentro de la capa con zoom, así acompaña a la figura en su movimiento.
 */
export function LightPoints({ lights, iw, ih }: { lights: LightPoint[]; iw: number; ih: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = box.w && box.h ? Math.min(box.w / iw, box.h / ih) : 0;
  const w = iw * s, h = ih * s;
  const ox = (box.w - w) / 2, oy = (box.h - h) / 2;

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {s > 0 &&
        lights.map((l, i) => {
          const d = Math.max(4, (l.size / 100) * w);
          return (
            <span
              key={i}
              className="light-point"
              style={{ left: ox + l.u * w, top: oy + l.v * h, width: d, height: d, '--lc': l.color, animationDelay: `${i * 0.37}s` } as CSSProperties}
            />
          );
        })}
    </div>
  );
}
