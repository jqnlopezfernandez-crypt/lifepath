import type { Framing } from './routes';

// Análisis de la silueta a partir de la transparencia del PNG.
// Sirve para dos cosas: encuadrar solo cada imagen y lanzar los efectos
// desde el contorno real de cada personaje (no desde puntos al azar).

export interface Silhouette {
  iw: number;
  ih: number;
  /** Caja de la figura, normalizada 0–1. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** Puntos del contorno, normalizados 0–1: [x0, y0, x1, y1, …] */
  edges: number[];
  /** Cuánto ocupa la figura en la franja inferior (pies ≈ poco; busto cortado ≈ mucho). */
  bottomCover: number;
}

/** Caja de la figura dentro del escenario, igual que .stage-figure en stage.css (inset 4% 4% 6%). */
export const FIGURE_BOX = { left: 0.04, top: 0.04, right: 0.04, bottom: 0.06 };

const cache = new Map<string, Promise<Silhouette | null>>();
const SAMPLE_W = 200;

export function analyzeImage(src: string): Promise<Silhouette | null> {
  const hit = cache.get(src);
  if (hit) return hit;
  const job = (async () => {
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const w = Math.min(SAMPLE_W, iw);
      const h = Math.max(1, Math.round((ih / iw) * w));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3]);

      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      const edges: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = a(x, y);
          if (v > 40) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          if (v > 110 && (a(x - 1, y) <= 110 || a(x + 1, y) <= 110 || a(x, y - 1) <= 110 || a(x, y + 1) <= 110)) {
            edges.push((x + 0.5) / w, (y + 0.5) / h);
          }
        }
      }
      if (x1 <= x0 || y1 <= y0) return null;

      const band = Math.max(1, Math.floor((y1 - y0) * 0.03));
      let filled = 0, total = 0;
      for (let y = y1 - band; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) { total++; if (a(x, y) > 110) filled++; }
      }

      // Como mucho ~900 puntos para que los efectos vayan fluidos.
      const n = edges.length / 2;
      const step = Math.max(1, Math.ceil(n / 900));
      const reduced: number[] = [];
      for (let i = 0; i < n; i += step) reduced.push(edges[i * 2], edges[i * 2 + 1]);

      return {
        iw, ih,
        bbox: { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h },
        edges: reduced,
        bottomCover: total ? filled / total : 1
      };
    } catch {
      return null;
    }
  })();
  cache.set(src, job);
  return job;
}

/** Punto de luz colocado sobre la imagen (coordenadas normalizadas de la imagen). */
export interface LightPoint {
  u: number;
  v: number;
  /** Diámetro en % del ancho de la imagen mostrada. */
  size: number;
  color: string;
}

/**
 * Busca los puntos más brillantes de la figura (luces que ya existen en la imagen,
 * como visores o núcleos de energía) para añadirles un brillo animado encima.
 */
export async function detectBrightSpots(src: string, max = 3): Promise<LightPoint[]> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = Math.min(SAMPLE_W, img.naturalWidth);
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = d[i * 4 + 3];
      lum[i] = a > 200 ? 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2] : 0;
    }
    // Brillo medio en un vecindario 3×3: prefiere manchas de luz a reflejos de un píxel.
    const cand: { x: number; y: number; score: number }[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += lum[(y + dy) * w + x + dx];
        s /= 9;
        if (s > 215) cand.push({ x, y, score: s });
      }
    }
    cand.sort((a, b) => b.score - a.score);
    const picked: { x: number; y: number }[] = [];
    const minDist = w * 0.06;
    for (const c of cand) {
      if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > minDist)) picked.push(c);
      if (picked.length >= max) break;
    }
    return picked.map((p) => {
      // Color de la luz: el tono medio alrededor del punto, aclarado.
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = Math.min(w - 1, Math.max(0, p.x + dx)), yy = Math.min(h - 1, Math.max(0, p.y + dy));
        const i = (yy * w + xx) * 4;
        if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      }
      const hex = (v: number) => Math.round(Math.min(255, v)).toString(16).padStart(2, '0');
      const color = n ? `#${hex(r / n)}${hex(g / n)}${hex(b / n)}` : '#bfe8ff';
      return { u: (p.x + 0.5) / w, v: (p.y + 0.5) / h, size: 5, color };
    });
  } catch {
    return [];
  }
}

/** Convierte un toque en el escenario (px) a coordenadas normalizadas de la imagen. */
export function stageToImage(sil: Silhouette, framing: Framing, W: number, H: number, x: number, y: number) {
  const fx0 = FIGURE_BOX.left * W, fy0 = FIGURE_BOX.top * H;
  const fw = W * (1 - FIGURE_BOX.left - FIGURE_BOX.right);
  const fh = H * (1 - FIGURE_BOX.top - FIGURE_BOX.bottom);
  const s = Math.min(fw / sil.iw, fh / sil.ih);
  const w = sil.iw * s, h = sil.ih * s;
  const ox = fx0 + (fw - w) / 2, oy = fy0 + (fh - h) / 2;
  const Ox = fx0 + (fw * framing.focusX) / 100, Oy = fy0 + (fh * framing.focusY) / 100;
  const px = Ox + (x - Ox) / framing.zoom, py = Oy + (y - Oy) / framing.zoom;
  return { u: (px - ox) / w, v: (py - oy) / h };
}

/** Rectángulo de la figura (en px del escenario) y transformación imagen → escenario. */
function geometry(sil: Silhouette, framing: Framing, W: number, H: number) {
  const fx0 = FIGURE_BOX.left * W, fy0 = FIGURE_BOX.top * H;
  const fw = W * (1 - FIGURE_BOX.left - FIGURE_BOX.right);
  const fh = H * (1 - FIGURE_BOX.top - FIGURE_BOX.bottom);
  const s = Math.min(fw / sil.iw, fh / sil.ih);
  const w = sil.iw * s, h = sil.ih * s;
  const ox = fx0 + (fw - w) / 2, oy = fy0 + (fh - h) / 2;
  const Ox = fx0 + (fw * framing.focusX) / 100, Oy = fy0 + (fh * framing.focusY) / 100;
  const z = framing.zoom;
  const map = (u: number, v: number) => ({ x: Ox + (ox + u * w - Ox) * z, y: Oy + (oy + v * h - Oy) * z });
  return { fx0, fy0, fw, fh, map };
}

/** Puntos del contorno visibles en el escenario (px), para lanzar efectos desde la figura. */
export function edgePointsOnStage(sil: Silhouette, framing: Framing, W: number, H: number): { x: number; y: number }[] {
  const g = geometry(sil, framing, W, H);
  const maxY = g.fy0 + g.fh * 0.8; // por debajo, la figura se desvanece
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < sil.edges.length; i += 2) {
    const p = g.map(sil.edges[i], sil.edges[i + 1]);
    if (p.x >= g.fx0 && p.x <= g.fx0 + g.fw && p.y >= g.fy0 && p.y <= maxY) out.push(p);
  }
  return out;
}

/**
 * Encuadre automático: figuras de cuerpo entero → de la cabeza a la cintura;
 * bustos o imágenes cortadas → la figura completa. Deja aire por encima de la cabeza.
 */
export function autoFraming(sil: Silhouette, W = 390, H = 470): Framing {
  const { x0, y0, x1, y1 } = sil.bbox;
  const bodyH = y1 - y0;
  const aspect = (bodyH * sil.ih) / ((x1 - x0) * sil.iw);
  // Cuerpo entero: figura muy alargada, o con poca ocupación abajo (pies).
  const tall = aspect >= 1.9 || (sil.bottomCover < 0.4 && aspect > 1.3);
  const regionH = tall ? bodyH * 0.46 : bodyH;

  // Centro horizontal de la parte visible (no de los brazos extendidos de abajo).
  let minX = 1, maxX = 0;
  for (let i = 0; i < sil.edges.length; i += 2) {
    const v = sil.edges[i + 1];
    if (v >= y0 && v <= y0 + regionH * 0.6) {
      minX = Math.min(minX, sil.edges[i]);
      maxX = Math.max(maxX, sil.edges[i]);
    }
  }
  if (maxX <= minX) { minX = x0; maxX = x1; }

  const g = geometry(sil, { zoom: 1, focusX: 50, focusY: 50 }, W, H);
  const top = g.map(0, y0).y;
  const bottom = g.map(0, y0 + regionH).y;
  const left = g.map(minX, 0).x;
  const right = g.map(maxX, 0).x;
  const cx = (left + right) / 2;

  let z = (g.fh * 0.86) / Math.max(1, bottom - top);
  z = Math.min(z, (g.fw * 1.05) / Math.max(1, right - left));
  z = Math.max(1, Math.min(4, z));
  if (z < 1.02) return { zoom: 1, focusX: 50, focusY: 50 };

  const targetTop = g.fy0 + g.fh * 0.08; // aire por encima de la cabeza
  const Oy = (targetTop - z * top) / (1 - z);
  const Ox = (g.fx0 + g.fw / 2 - z * cx) / (1 - z);
  const clamp = (v: number) => Math.max(-40, Math.min(140, v));
  return {
    zoom: Math.round(z * 100) / 100,
    focusX: Math.round(clamp(((Ox - g.fx0) / g.fw) * 100)),
    focusY: Math.round(clamp(((Oy - g.fy0) / g.fh) * 100))
  };
}
