// Auras precalculadas: la silueta del personaje se colorea y se difumina UNA vez
// (reduciéndola mucho y volviéndola a ampliar, que es un desenfoque casi gratis).
// Después solo se animan su posición y opacidad, que el iPhone mueve con la GPU.

/** Margen alrededor de la figura (fracción de cada lado) para que el brillo quepa. */
export const SPRITE_MARGIN = 0.2;

export interface AuraSprites {
  base: string;      // aura ceñida
  wide: string;      // aura amplia y muy difusa
  fire: string;      // aura con degradado de llama
  shadow: string;    // silueta oscura casi nítida (presencias)
}

type Fill = string | { stops: [number, string][] };

const cache = new Map<string, Promise<AuraSprites | null>>();

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/**
 * Dibuja la silueta coloreada a `tinyW` px de ancho (el desenfoque sale de ahí),
 * con margen alrededor, y la amplía suavemente a `outW` px.
 */
function render(img: HTMLImageElement, tinyW: number, outW: number, fill: Fill): Promise<string> {
  const ar = img.naturalHeight / img.naturalWidth;
  const m = SPRITE_MARGIN;
  const make = (w: number) => {
    const c = document.createElement('canvas');
    c.width = Math.max(4, Math.round(w * (1 + 2 * m)));
    c.height = Math.max(4, Math.round(w * ar * (1 + 2 * m)));
    return c;
  };

  // 1) Silueta coloreada en pequeño.
  const tiny = make(tinyW);
  const t = tiny.getContext('2d')!;
  t.imageSmoothingQuality = 'high';
  const ix = tiny.width * (m / (1 + 2 * m)), iy = tiny.height * (m / (1 + 2 * m));
  const iw = tiny.width / (1 + 2 * m), ih = tiny.height / (1 + 2 * m);
  t.drawImage(img, ix, iy, iw, ih);
  t.globalCompositeOperation = 'source-in';
  if (typeof fill === 'string') {
    t.fillStyle = fill;
  } else {
    const g = t.createLinearGradient(0, tiny.height, 0, 0);
    for (const [o, c] of fill.stops) g.addColorStop(o, c);
    t.fillStyle = g;
  }
  t.fillRect(0, 0, tiny.width, tiny.height);

  // 2) Ampliación en dos pasos para un desenfoque más suave.
  const mid = make(Math.min(outW, tinyW * 3));
  const md = mid.getContext('2d')!;
  md.imageSmoothingQuality = 'high';
  md.drawImage(tiny, 0, 0, mid.width, mid.height);
  const out = make(outW);
  const o = out.getContext('2d')!;
  o.imageSmoothingQuality = 'high';
  o.drawImage(mid, 0, 0, out.width, out.height);

  return new Promise((resolve) => out.toBlob((b) => resolve(b ? URL.createObjectURL(b) : ''), 'image/png'));
}

export function buildAuraSprites(src: string, accent: string, accent2: string, darkAura: boolean): Promise<AuraSprites | null> {
  const key = `${src}|${accent}|${accent2}|${darkAura}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    try {
      const img = await loadImage(src);
      const baseColor = darkAura ? mix(accent2, '#000000', 0.35) : accent;
      const [base, wide, fire, shadow] = await Promise.all([
        render(img, 26, 200, baseColor),
        render(img, 11, 180, darkAura ? accent : accent2),
        render(img, 18, 200, { stops: [[0, accent2], [0.45, accent], [1, '#ffe2a8']] }),
        render(img, 110, 320, { stops: [[0, 'rgba(0,0,0,0)'], [0.4, mix(accent2, '#000000', 0.6)], [1, '#000000']] })
      ]);
      return { base, wide, fire, shadow };
    } catch {
      return null;
    }
  })();
  cache.set(key, job);
  return job;
}

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => {
    const s = h.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
