import { useEffect, useRef } from 'react';
import type { EffectKind, Framing } from '../routes';
import { edgePointsOnStage, type Silhouette } from '../silhouette';

// Motor de partículas en <canvas>, sin dependencias.
// Si hay silueta, las partículas nacen del contorno real del personaje
// y los rayos recorren su borde. La intensidad crece con el nivel.

interface Props {
  effects: EffectKind[];
  accent: string;
  accent2: string;
  intensity: number; // ~0.55 (nivel 1) → ~1.55 (nivel 10)
  silhouette: Silhouette | null;
  framing: Framing;
  burstKey?: number;
  /** Se llama en los impactos fuertes (para sacudir la figura). */
  onImpact?: (strength: number) => void;
}

interface P {
  kind: EffectKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number;
  color: string;
  angle: number; spin: number;
  radius: number;
  seed: number;
  bounced: boolean;
  tilt: number; // achatamiento de la órbita
  tx?: number; ty?: number; // destino (nanopartículas que se ensamblan)
  rot: number;  // inclinación del plano de la órbita
}

interface Bolt { pts: { x: number; y: number }[]; life: number; max: number; color: string; width: number; dark?: boolean }

const BASE_COUNT: Record<EffectKind, number> = {
  embers: 34, sparks: 14, frost: 22, shadow: 14, lightning: 0, drops: 26,
  streaks: 10, orbit: 18, dust: 18, smoke: 9, feathers: 9, cosmic: 26,
  mist: 12, flames: 28, decay: 44,
  // Los efectos de técnica son eventos, no partículas continuas.
  orbs: 0, ripples: 0, slashes: 0, blackflash: 0, beam: 0, pool: 0, pulse: 0, starburst: 0, afterimage: 0, verdict: 0,
  scan: 0, hex: 70, stomp: 0, stones: 0, dual: 0, explosions: 0, cracks: 0, presence: 0
};

const STONE_COLORS = ['#b04bff', '#3f8cff', '#ff3b3b', '#ff9a2e', '#3fe07a', '#ffd23f'];

/** Eventos con duración propia (ondas, cortes, haces, destellos…). */
interface Ev {
  type: 'ripple' | 'slash' | 'beam' | 'pulse' | 'star' | 'flash' | 'implode' | 'vignette' | 'spot' | 'shock' | 'scan' | 'crack';
  pts?: { x: number; y: number }[];
  x: number; y: number;
  x2: number; y2: number;
  life: number; max: number;
  size: number;
  color: string;
}

const RED_ORB = '#ff3b5c';
const PURPLE = '#a24bff';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };

// Sprites de brillo precalculados: mucho más rápido que crear degradados en cada fotograma.
const spriteCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string, soft = false): HTMLCanvasElement {
  const key = color + (soft ? 's' : 'h');
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) {
    grad.addColorStop(0, rgba(color, 0.55));
    grad.addColorStop(0.5, rgba(color, 0.22));
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, rgba(color, 0.95));
    grad.addColorStop(0.45, rgba(color, 0.25));
  }
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(key, c);
  return c;
}

export function ParticleField({ effects, accent, accent2, intensity, silhouette, framing, burstKey, onImpact }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef(0);
  const impactRef = useRef(onImpact);
  impactRef.current = onImpact;

  useEffect(() => {
    if (burstKey) burstRef.current++;
  }, [burstKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    let edges: { x: number; y: number }[] = [];
    let traced: { x: number; y: number; a: number }[] = [];
    let groundY = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      edges = silhouette ? edgePointsOnStage(silhouette, framing, W, H) : [];
      // Contorno ordenado por ángulo alrededor del centro: permite "recorrer" la silueta.
      const ox = W / 2, oy = H * 0.46;
      // Solo el borde exterior: por cada franja de ángulo, el punto más alejado del centro.
      const BINS = 240;
      const outer: ({ x: number; y: number; a: number; r: number } | undefined)[] = new Array(BINS);
      for (const p of edges) {
        const a = Math.atan2(p.y - oy, p.x - ox);
        const r = Math.hypot(p.x - ox, p.y - oy);
        const b = Math.floor(((a + Math.PI) / (Math.PI * 2)) * BINS) % BINS;
        const cur = outer[b];
        if (!cur || r > cur.r) outer[b] = { x: p.x, y: p.y, a, r };
      }
      traced = outer.filter((p): p is { x: number; y: number; a: number; r: number } => !!p);
      groundY = H * 0.9;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const palette = [accent, accent2, '#ffffff'];
    const cx = () => W / 2;
    const cy = () => H * 0.46;
    // Punto de nacimiento: el contorno de la figura si existe; si no, una zona central.
    // Con 'dual', el fuego nace del lado derecho de la figura y el hielo del izquierdo.
    const dualMode = effects.includes('dual');
    const fromSide = (right: boolean) => {
      if (edges.length) {
        for (let tries = 0; tries < 10; tries++) {
          const p = pick(edges);
          if ((p.x >= cx()) === right) return { x: p.x, y: p.y };
        }
      }
      return { x: cx() + (right ? 1 : -1) * rand(W * 0.05, W * 0.25), y: cy() + rand(-H * 0.25, H * 0.25) };
    };
    const fromEdge = (upperOnly = false) => {
      if (edges.length) {
        for (let tries = 0; tries < 6; tries++) {
          const p = pick(edges);
          if (!upperOnly || p.y < H * 0.62) return { x: p.x, y: p.y };
        }
        return pick(edges);
      }
      return { x: cx() + rand(-W * 0.22, W * 0.22), y: cy() + rand(-H * 0.25, H * 0.25) };
    };

    const spawn = (kind: EffectKind, initial = false): P => {
      const p: P = {
        kind, x: rand(0, W), y: rand(0, H), vx: 0, vy: 0, life: 0, max: rand(2, 5),
        size: rand(1, 2.2) * (0.75 + intensity * 0.35), color: pick(palette), angle: rand(0, Math.PI * 2),
        spin: rand(-1, 1), radius: 0, seed: rand(0, 1000), bounced: false, tilt: 0.36, rot: 0
      };
      const k = 0.75 + intensity * 0.35;
      switch (kind) {
        case 'embers': {
          const s = dualMode ? fromSide(true) : fromEdge();
          p.x = s.x + rand(-4, 4); p.y = s.y;
          p.vx = rand(-10, 10); p.vy = rand(-60, -28) * k;
          p.max = rand(1.4, 3.2); p.color = pick([accent, accent2]);
          break;
        }
        case 'sparks': {
          const s = fromEdge(true);
          p.x = s.x; p.y = s.y;
          const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), sp = rand(90, 230) * k;
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
          p.max = rand(0.6, 1.3); p.size *= 0.75; p.color = pick([accent, '#fff3d6', accent2]);
          break;
        }
        case 'frost': {
          const s = dualMode ? fromSide(false) : fromEdge();
          p.x = s.x + rand(-30, 30); p.y = s.y + rand(-30, 30);
          if (dualMode) { p.x = Math.min(p.x, cx() - 6); p.vy = rand(4, 14); } // el frío cae
          p.vx = rand(-6, 6); p.vy = rand(-12, 4); p.max = rand(2.5, 5); p.size = rand(2, 4.5);
          p.color = pick(['#e6f8ff', accent2]);
          break;
        }
        case 'shadow': {
          const s = fromEdge();
          p.x = s.x; p.y = s.y;
          // Con charco de sombra, la mayoría de jirones brotan del suelo.
          if (effects.includes('pool') && Math.random() < 0.6) { p.x = cx() + rand(-W * 0.3, W * 0.3); p.y = groundY; }
          p.vx = rand(-8, 8); p.vy = rand(-26, -10);
          p.size = rand(16, 34) * k; p.max = rand(2.5, 4.5); p.color = accent2;
          break;
        }
        case 'drops': {
          // Dos anillos de sangre con planos distintos; todas las gotas de un anillo giran juntas.
          const ring = Math.random() < 0.55 ? 0 : 1;
          p.radius = (ring ? W * 0.4 : W * 0.3) * rand(0.95, 1.05);
          p.spin = (ring ? -0.9 : 1.15) * rand(0.95, 1.05);
          p.tilt = ring ? 0.3 : 0.42;
          p.rot = ring ? 0.35 : -0.22;
          p.size = rand(2.2, 5.5) * k; p.color = pick([accent, accent, accent2]); p.max = rand(5, 9);
          break;
        }
        case 'hex': {
          // Nanopartícula: nace fuera de la figura y viaja hasta encajar en el contorno.
          const s = fromEdge();
          const a = Math.atan2(s.y - cy(), s.x - cx()) + rand(-0.5, 0.5);
          const d = rand(26, 70);
          p.tx = s.x; p.ty = s.y;
          p.x = s.x + Math.cos(a) * d; p.y = s.y + Math.sin(a) * d;
          p.size = rand(0.9, 1.8) * k; p.max = rand(0.9, 1.6);
          p.color = pick([accent, accent2, '#e8fbff']);
          break;
        }
        case 'decay': {
          // Fragmentos que se desprenden de la figura y se deshacen al subir.
          const s = fromEdge();
          p.x = s.x; p.y = s.y;
          p.vx = rand(-14, 14); p.vy = rand(-42, -16);
          p.size = rand(1.6, 4) * k; p.max = rand(1.4, 3);
          p.color = pick(['#a3a7ae', '#6d727b', '#c9ccd2', accent]);
          p.spin = rand(-4, 4);
          break;
        }
        case 'flames': {
          const s = dualMode ? fromSide(true) : fromEdge(true);
          p.x = s.x + rand(-3, 3); p.y = s.y;
          p.vx = rand(-8, 8); p.vy = rand(-75, -40) * k;
          p.size = rand(7, 15) * k; p.max = rand(0.55, 1.05);
          break;
        }
        case 'mist':
          p.x = rand(-W * 0.2, W * 1.2); p.y = H * rand(0.42, 0.95);
          p.vx = rand(6, 16) * (Math.random() < 0.5 ? -1 : 1); p.vy = rand(-2, 2);
          p.size = rand(60, 115); p.max = rand(6, 11); p.color = pick([accent2, accent2, accent]);
          break;
        case 'streaks':
          p.x = rand(-W * 0.4, W); p.y = rand(H * 0.08, H * 0.88);
          p.vx = rand(420, 680) * k; p.vy = rand(-20, 6); p.max = rand(0.3, 0.6); p.size = rand(0.8, 1.8);
          p.color = pick([accent, '#ffffff']);
          break;
        case 'orbit':
          p.radius = rand(W * 0.2, W * 0.46); p.spin = rand(0.2, 0.6) * (Math.random() < 0.5 ? -1 : 1);
          p.max = rand(4, 8); p.size *= 1.1;
          break;
        case 'dust':
          p.x = rand(W * 0.12, W * 0.88); p.y = groundY + rand(-6, 8);
          p.vx = rand(-30, 30); p.vy = rand(-26, -6); p.size = rand(1.2, 3); p.max = rand(1.6, 3.2);
          break;
        case 'smoke': {
          const s = fromEdge();
          p.x = s.x; p.y = s.y + rand(0, 30);
          p.vx = rand(-6, 6); p.vy = rand(-18, -8); p.size = rand(22, 40); p.max = rand(4, 7);
          p.color = '#7b8494';
          break;
        }
        case 'feathers':
          p.x = rand(0, W); p.y = rand(-40, -10); p.vy = rand(22, 40); p.size = rand(7, 12);
          p.color = pick([accent, accent2]); p.max = rand(6, 9);
          break;
        case 'cosmic': {
          const s = fromEdge();
          p.x = s.x + rand(-40, 40); p.y = s.y + rand(-40, 40);
          p.vx = rand(-5, 5); p.vy = rand(-8, 2); p.max = rand(1.2, 3); p.size *= 1.3;
          p.color = pick([accent, accent2, '#b28dff', '#5ce1ff', '#ffffff']);
          break;
        }
        case 'lightning':
          break;
      }
      if (initial) p.life = rand(0, p.max);
      return p;
    };

    const targetCounts = effects.map((k) => [k, Math.round(BASE_COUNT[k] * intensity)] as const);
    const targetTotal = targetCounts.reduce((s, [, n]) => s + n, 0);
    const particles: P[] = [];
    for (const [k, n] of targetCounts) for (let i = 0; i < n; i++) particles.push(spawn(k, true));

    const bolts: Bolt[] = [];
    // Rayo que sigue el contorno: recorre puntos vecinos del borde.
    const makeBolt = (big = false) => {
      const color = pick([accent, accent2]);
      if (edges.length > 20) {
        let cur = pick(edges.filter((e) => e.y < H * 0.7)) ?? pick(edges);
        const pts = [cur];
        const used = new Set<{ x: number; y: number }>([cur]);
        const steps = big ? 16 : 10;
        for (let i = 0; i < steps; i++) {
          let best: { x: number; y: number } | null = null, bestD = Infinity;
          for (const e of edges) {
            if (used.has(e)) continue;
            const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
            if (d > 36 && d < bestD) { bestD = d; best = e; }
          }
          if (!best || bestD > 900) break;
          used.add(best);
          cur = best;
          pts.push(best);
        }
        const jag = pts.map((p) => ({ x: p.x + rand(-5, 5), y: p.y + rand(-5, 5) }));
        bolts.push({ pts: jag, life: 0, max: big ? 0.32 : 0.2, color, width: big ? 2.4 : 1.5 });
        // Rama que salta hacia fuera.
        const from = jag[Math.floor(jag.length / 2)];
        if (from && (big || Math.random() < 0.6)) {
          const dir = from.x < cx() ? -1 : 1;
          const branch = [from];
          for (let i = 1; i <= 4; i++) branch.push({ x: from.x + dir * i * rand(6, 14), y: from.y + rand(-10, 10) });
          bolts.push({ pts: branch, life: 0, max: 0.18, color, width: 1 });
        }
        return;
      }
      const sx = cx() + rand(-W * 0.3, W * 0.3), sy = rand(H * 0.1, H * 0.4);
      const pts = [{ x: sx, y: sy }];
      for (let i = 1; i <= 8; i++) pts.push({ x: sx + rand(-14, 14) * i * 0.4, y: sy + i * rand(10, 18) });
      bolts.push({ pts, life: 0, max: 0.22, color, width: 1.6 });
    };

    let raf = 0;
    let last = performance.now();
    let boltTimer = rand(0.4, 1.2);
    let lastBurst = burstRef.current;
    let time = 0;
    const hasLightning = effects.includes('lightning');
    const has = (k: EffectKind) => effects.includes(k);
    const k = 0.75 + intensity * 0.35;

    // ── Eventos de técnica ──
    const events: Ev[] = [];
    const timers = {
      ripple: 0.3, slash: rand(0.8, 1.5), black: rand(1.2, 2.5), beam: rand(0.8, 2), pulse: 0.6, star: rand(0.3, 0.9), verdict: 1.2,
      scan: 0.8, stomp: 1.5, explosion: rand(0.6, 1.4), crack: 1.2
    };
    // Gemas en órbita
    let stonesAngle = 0, stonesClock = 0;
    const ev = (e: Partial<Ev> & Pick<Ev, 'type' | 'x' | 'y' | 'max' | 'size' | 'color'>) =>
      events.push({ x2: e.x, y2: e.y, life: 0, ...e });
    // Acciones programadas en el tiempo (para secuencias: carga → impacto, ráfagas de tajos…).
    const pending: { at: number; fn: () => void }[] = [];
    const later = (delay: number, fn: () => void) => pending.push({ at: time + delay, fn });

    // Rayo negro irregular que sale de un punto.
    const darkBolt = (x0: number, y0: number, a: number, len: number) => {
      const pts = [{ x: x0, y: y0 }];
      let x = x0, y = y0;
      const segs = 9;
      for (let i = 0; i < segs; i++) {
        const d = (len / segs) * rand(0.7, 1.3);
        const aa = a + rand(-0.8, 0.8);
        x += Math.cos(aa) * d; y += Math.sin(aa) * d;
        pts.push({ x, y });
        // Ramas cortas
        if (i > 2 && Math.random() < 0.3) {
          const ba = aa + rand(-1.2, 1.2), bl = len * rand(0.15, 0.3);
          bolts.push({ pts: [{ x, y }, { x: x + Math.cos(ba) * bl * 0.5 + rand(-4, 4), y: y + Math.sin(ba) * bl * 0.5 + rand(-4, 4) }, { x: x + Math.cos(ba) * bl, y: y + Math.sin(ba) * bl }], life: 0, max: rand(0.25, 0.4), color: accent, width: 1.3, dark: true });
        }
      }
      bolts.push({ pts, life: 0, max: rand(0.38, 0.55), color: accent, width: rand(2, 3.2), dark: true });
    };

    // Chispazo negro: carga breve (la energía se contrae) y luego impacto.
    const blackFlash = () => {
      const s = fromEdge(true);
      ev({ type: 'implode', x: s.x, y: s.y, size: 70 * k, max: 0.2, color: accent });
      later(0.2, () => {
        ev({ type: 'vignette', x: s.x, y: s.y, size: Math.max(W, H), max: 0.32, color: accent });
        ev({ type: 'flash', x: s.x, y: s.y, size: 70 * k, max: 0.4, color: accent });
        ev({ type: 'shock', x: s.x, y: s.y, size: W * 0.55, max: 0.5, color: accent });
        const n = 7 + Math.round(intensity * 2);
        for (let b = 0; b < n; b++) darkBolt(s.x, s.y, (b / n) * Math.PI * 2 + rand(-0.3, 0.3), W * rand(0.22, 0.42));
        // Segundo latido de rayos un instante después.
        later(0.09, () => { for (let b = 0; b < 4; b++) darkBolt(s.x, s.y, rand(0, Math.PI * 2), W * rand(0.15, 0.3)); });
        for (let i = 0; i < 26; i++) {
          const p = spawn('sparks');
          p.x = s.x; p.y = s.y;
          const a = rand(0, Math.PI * 2), sp = rand(150, 380);
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.color = pick([accent, '#ffd0d0', '#ffffff']);
          particles.push(p);
        }
        impactRef.current?.(1);
      });
    };

    // Tajo que cruza toda la pantalla pasando cerca de la figura.
    const screenCut = () => {
      const s = fromEdge(true);
      const a = rand(-Math.PI, Math.PI);
      const len = Math.hypot(W, H) * 1.3;
      ev({ type: 'slash', x: s.x - Math.cos(a) * len / 2, y: s.y - Math.sin(a) * len / 2, x2: s.x + Math.cos(a) * len / 2, y2: s.y + Math.sin(a) * len / 2, size: rand(0.8, 1.3) * k, max: rand(0.28, 0.4), color: accent });
      ev({ type: 'vignette', x: s.x, y: s.y, size: Math.max(W, H), max: 0.14, color: '#ffffff' });
      for (let i = 0; i < 8; i++) {
        const p = spawn('sparks');
        const t = rand(0.3, 0.7);
        p.x = s.x + Math.cos(a) * len * (t - 0.5); p.y = s.y + Math.sin(a) * len * (t - 0.5);
        const pa = a + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1), sp = rand(60, 160);
        p.vx = Math.cos(pa) * sp; p.vy = Math.sin(pa) * sp; p.color = pick([accent, '#ffffff']);
        particles.push(p);
      }
      impactRef.current?.(0.6);
    };

    // Juicio: columna de luz que cae y golpe seco en el suelo.
    const verdict = () => {
      ev({ type: 'spot', x: cx(), y: 0, size: W * 0.42, max: 1.6, color: accent });
      later(0.55, () => {
        ev({ type: 'flash', x: cx(), y: cy() - H * 0.08, size: 110 * k, max: 0.6, color: accent });
        ev({ type: 'pulse', x: cx(), y: cy(), size: W * 0.6, max: 0.9, color: accent });
        for (let i = 0; i < 18; i++) {
          const p = spawn('dust');
          p.x = cx() + rand(-W * 0.2, W * 0.2); p.y = groundY;
          p.vx = rand(-90, 90); p.vy = rand(-70, -20);
          particles.push(p);
        }
        impactRef.current?.(0.7);
      });
    };

    // Orbes: orbitan, convergen y estallan.
    let orbAngle = 0, orbClock = 0, orbFired = false;
    const ORB_PERIOD = 8 - intensity * 1.6;

    const drawGlow = (x: number, y: number, r: number, color: string, alpha: number, soft = false) => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(glowSprite(color, soft), x - r, y - r, r * 2, r * 2);
    };
    // Destello de lente: núcleo brillante con una raya horizontal suave (anamórfica).
    const glint = (x: number, y: number, r: number, color: string, alpha: number) => {
      const a = Math.max(0, Math.min(1, alpha));
      ctx.globalAlpha = a * 0.8;
      ctx.drawImage(glowSprite(color), x - r * 5, y - r * 0.28, r * 10, r * 0.56);
      ctx.globalAlpha = a * 0.35;
      ctx.drawImage(glowSprite(color), x - r * 0.22, y - r * 2.2, r * 0.44, r * 4.4);
      drawGlow(x, y, r * 1.3, color, a);
      drawGlow(x, y, r * 0.45, '#ffffff', a);
    };
    // Onda de luz suave (no una línea): banda difusa que se expande.
    const softRing = (x: number, y: number, r: number, squash: number, width: number, color: string, alpha: number) => {
      if (r <= 1 || alpha <= 0) return;
      const inner = Math.max(0, r - width), outer = r + width;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, squash);
      const g = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(0.5, rgba(color, alpha));
      g.addColorStop(0.62, `rgba(255,255,255,${alpha * 0.5})`);
      g.addColorStop(1, rgba(color, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, outer, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      ctx.clearRect(0, 0, W, H);

      if (burstRef.current !== lastBurst) {
        lastBurst = burstRef.current;
        for (let i = 0; i < Math.round(36 * intensity); i++) {
          const p = spawn('sparks');
          const s = fromEdge(true);
          p.x = s.x; p.y = s.y;
          const a = Math.atan2(s.y - cy(), s.x - cx()) + rand(-0.6, 0.6), sp = rand(160, 380);
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.max = rand(0.5, 1.1);
          particles.push(p);
        }
        if (hasLightning) for (let i = 0; i < 4; i++) makeBolt(true);
      }

      if (hasLightning) {
        boltTimer -= dt;
        if (boltTimer <= 0) {
          makeBolt(intensity > 1.2 && Math.random() < 0.45);
          boltTimer = rand(0.35, 1.8) / intensity;
        }
      }

      // Programación de eventos de técnica
      if (has('ripples') && (timers.ripple -= dt) <= 0) {
        ev({ type: 'ripple', x: cx(), y: cy(), size: W * 0.62, max: 2.6, color: accent });
        timers.ripple = 1.4 / Math.sqrt(intensity);
      }
      // Ejecuta las acciones programadas que ya tocan.
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i].at <= time) { const { fn } = pending[i]; pending.splice(i, 1); fn(); }
      }

      if (has('slashes') && (timers.slash -= dt) <= 0) {
        // Ráfaga de 2–5 tajos casi seguidos.
        const n = 2 + Math.floor(Math.random() * (2 + intensity * 1.5));
        for (let i = 0; i < n; i++) later(i * rand(0.05, 0.11), screenCut);
        timers.slash = rand(1.3, 2.6) / Math.sqrt(intensity);
      }
      if (has('verdict') && (timers.verdict -= dt) <= 0) {
        verdict();
        timers.verdict = rand(4, 6);
      }
      if (has('stomp') && (timers.stomp -= dt) <= 0) {
        ev({ type: 'vignette', x: cx(), y: cy(), size: Math.max(W, H), max: 0.25, color: accent });
        for (let i = 0; i < 26; i++) {
          const p = spawn('dust');
          p.x = cx() + rand(-W * 0.22, W * 0.22); p.y = groundY;
          p.vx = rand(-120, 120); p.vy = rand(-80, -20); p.size *= 1.3;
          particles.push(p);
        }
        impactRef.current?.(1);
        timers.stomp = rand(3.2, 4.4);
      }
      if (has('explosions') && (timers.explosion -= dt) <= 0) {
        // Explosión en un punto del contorno: destello, onda, humo y chispas.
        const s = fromEdge(true);
        ev({ type: 'flash', x: s.x, y: s.y, size: 55 * k, max: 0.35, color: '#fff1c9' });
        ev({ type: 'flash', x: s.x, y: s.y, size: 85 * k, max: 0.5, color: accent });
        ev({ type: 'shock', x: s.x, y: s.y, size: 70 * k, max: 0.4, color: accent2 });
        for (let i = 0; i < 18; i++) {
          const p = spawn('sparks');
          p.x = s.x; p.y = s.y;
          const a = rand(0, Math.PI * 2), sp = rand(140, 340);
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.color = pick([accent, accent2, '#fff1c9']);
          particles.push(p);
        }
        for (let i = 0; i < 4; i++) {
          const p = spawn('smoke');
          p.x = s.x + rand(-10, 10); p.y = s.y + rand(-10, 10); p.size = rand(18, 30); p.max = rand(1.5, 2.5);
          particles.push(p);
        }
        impactRef.current?.(0.5);
        timers.explosion = rand(0.9, 2.2) / intensity;
      }
      if (has('cracks') && (timers.crack -= dt) <= 0) {
        // Grietas que se abren por el suelo desde los pies.
        for (let c = 0; c < 4; c++) {
          const dir = c % 2 ? 1 : -1;
          const pts = [{ x: cx() + rand(-12, 12), y: groundY }];
          let x = pts[0].x, y = groundY;
          for (let i = 0; i < 8; i++) {
            x += dir * rand(8, 20); y += rand(-5, 5) + (c > 1 ? 2 : -1);
            pts.push({ x, y });
          }
          ev({ type: 'crack', x: pts[0].x, y: groundY, pts, size: 1, max: 1.6, color: accent });
        }
        impactRef.current?.(0.4);
        timers.crack = rand(3.2, 5);
      }
      if (has('blackflash') && (timers.black -= dt) <= 0) {
        blackFlash();
        timers.black = rand(2.2, 4) / intensity;
      }
      if (has('beam') && (timers.beam -= dt) <= 0) {
        const s = fromEdge(true);
        const dir = s.x < cx() ? -1 : 1;
        ev({ type: 'beam', x: s.x, y: s.y, x2: dir > 0 ? W + 20 : -20, y2: s.y + rand(-H * 0.15, H * 0.15), size: 1, max: 0.45, color: accent });
        ev({ type: 'flash', x: s.x, y: s.y, size: 26 * k, max: 0.3, color: accent });
        timers.beam = rand(1.6, 3.2) / intensity;
      }
      if (has('pulse') && (timers.pulse -= dt) <= 0) {
        ev({ type: 'pulse', x: cx(), y: cy(), size: W * 0.72, max: 1.8, color: accent });
        ev({ type: 'flash', x: cx(), y: cy(), size: 70 * k, max: 0.5, color: accent2 });
        timers.pulse = 2.6;
      }
      if (has('starburst') && (timers.star -= dt) <= 0) {
        const s = fromEdge(true);
        ev({ type: 'star', x: s.x, y: s.y, size: rand(10, 22) * k, max: 0.7, color: pick([accent, '#ffffff']) });
        timers.star = rand(0.35, 1.1) / intensity;
      }

      // Charco de sombra bajo los pies
      ctx.globalCompositeOperation = 'source-over';
      if (has('pool')) {
        const rx = W * 0.38 * (1 + Math.sin(time * 1.2) * 0.03), ry = H * 0.05;
        ctx.save();
        ctx.translate(cx(), groundY);
        ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, 'rgba(3,3,8,0.92)');
        g.addColorStop(0.65, 'rgba(3,3,8,0.7)');
        g.addColorStop(0.85, rgba(accent, 0.35));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Capa 1: humo y sombras (mezcla normal, detrás del brillo).
      ctx.globalCompositeOperation = 'source-over';
      for (const p of particles) {
        if (p.kind !== 'smoke' && p.kind !== 'shadow' && p.kind !== 'mist') continue;
        const t = p.life / p.max;
        const fade = Math.sin(Math.PI * Math.min(1, t));
        if (p.kind === 'mist') {
          // Niebla: manchas amplias y muy suaves, achatadas.
          const r = p.size * (1 + t * 0.4);
          ctx.globalAlpha = 0.5 * fade;
          ctx.drawImage(glowSprite('#06070f', true), p.x - r * 1.6, p.y - r * 0.6, r * 3.2, r * 1.2);
          ctx.globalAlpha = 0.32 * fade;
          ctx.drawImage(glowSprite(p.color, true), p.x - r * 1.4, p.y - r * 0.5, r * 2.8, r);
          continue;
        }
        const r = p.size * (1 + t * 1.6);
        if (p.kind === 'shadow') {
          ctx.globalAlpha = 0.55 * fade;
          ctx.drawImage(glowSprite('#05060a', true), p.x - r, p.y - r, r * 2, r * 2);
          drawGlow(p.x, p.y, r * 0.8, p.color, 0.5 * fade, true);
        } else {
          drawGlow(p.x, p.y, r, p.color, 0.28 * fade, true);
        }
      }

      // Capa 2: brillo aditivo.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        const t = p.life / p.max;
        if (t >= 1) {
          if (particles.length > targetTotal) particles.splice(i, 1);
          else particles[i] = spawn(p.kind);
          continue;
        }
        const fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;

        // Movimiento
        switch (p.kind) {
          case 'orbit':
          case 'drops': {
            p.angle += p.spin * dt;
            const ex = Math.cos(p.angle) * p.radius;
            const ey = Math.sin(p.angle) * p.radius * p.tilt;
            const cr = Math.cos(p.rot), sr = Math.sin(p.rot);
            p.x = cx() + ex * cr - ey * sr;
            p.y = cy() + ex * sr + ey * cr + Math.sin(time * 1.3 + p.seed) * (p.kind === 'drops' ? 3 : 6);
            break;
          }
          case 'embers':
            // Turbulencia: las brasas serpentean al subir.
            p.vx += Math.sin(time * 3 + p.seed) * 40 * dt;
            p.vy -= 8 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            break;
          case 'sparks':
            p.vy += 380 * dt;
            p.vx *= 1 - 0.6 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (!p.bounced && p.y > groundY) { p.y = groundY; p.vy *= -0.35; p.vx *= 0.6; p.bounced = true; }
            break;
          case 'feathers':
            p.angle += Math.sin(time * 1.5 + p.seed) * 1.5 * dt;
            p.vx = Math.sin(time * 1.8 + p.seed) * 34;
            p.x += p.vx * dt; p.y += p.vy * dt;
            break;
          case 'smoke':
          case 'shadow':
            p.vx += Math.sin(time + p.seed) * 6 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            break;
          default:
            p.x += p.vx * dt; p.y += p.vy * dt;
        }

        // Dibujo
        switch (p.kind) {
          case 'smoke':
          case 'shadow':
          case 'mist':
            break; // ya dibujados en la capa 1
          case 'hex': {
            // Viaje hacia el contorno con frenada final; al llegar, destello breve.
            const tx = p.tx ?? p.x, ty = p.ty ?? p.y;
            const travel = Math.min(1, t / 0.7);
            const e = 1 - (1 - travel) ** 3;
            const sx = p.x, sy = p.y; // posición de partida (no se modifica)
            const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e;
            if (t < 0.7) {
              // Estela corta en la dirección del movimiento
              const back = Math.max(0, travel - 0.12);
              const eb = 1 - (1 - back) ** 3;
              ctx.globalAlpha = 0.5 * Math.min(1, t / 0.15);
              ctx.strokeStyle = rgba(p.color, 1); ctx.lineWidth = p.size;
              ctx.beginPath(); ctx.moveTo(sx + (tx - sx) * eb, sy + (ty - sy) * eb); ctx.lineTo(x, y); ctx.stroke();
              drawGlow(x, y, p.size * 3, p.color, 0.8 * Math.min(1, t / 0.15));
            } else {
              const f = 1 - (t - 0.7) / 0.3;
              drawGlow(x, y, p.size * (3 + (1 - f) * 4), '#e8fbff', f * 0.9);
            }
            break;
          }
          case 'decay': {
            ctx.globalCompositeOperation = 'source-over';
            p.angle += p.spin * dt;
            const sz = p.size * (1 - t * 0.6);
            ctx.save();
            ctx.translate(p.x, p.y); ctx.rotate(p.angle);
            ctx.globalAlpha = 0.85 * fade;
            ctx.fillStyle = p.color;
            ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
            ctx.restore();
            ctx.globalCompositeOperation = 'lighter';
            break;
          }
          case 'flames': {
            // Lengua de fuego: alargada, del blanco al color y al rojo oscuro al apagarse.
            const col = t < 0.22 ? '#fff1c9' : t < 0.6 ? accent : accent2;
            const r = p.size * (1 - t * 0.45);
            const flick = 0.8 + Math.sin(time * 22 + p.seed) * 0.2;
            ctx.globalAlpha = fade * flick;
            ctx.drawImage(glowSprite(col), p.x - r * 0.55, p.y - r * 1.5, r * 1.1, r * 2.6);
            break;
          }
          case 'embers': {
            // Del blanco caliente al color de acento al enfriarse.
            const flicker = 0.75 + Math.sin(time * 18 + p.seed) * 0.25;
            drawGlow(p.x, p.y, p.size * 4.5, t < 0.3 ? '#fff1c9' : p.color, fade * flicker);
            break;
          }
          case 'sparks': {
            ctx.globalAlpha = fade;
            ctx.strokeStyle = rgba(p.color, 1);
            ctx.lineWidth = p.size;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
            drawGlow(p.x, p.y, p.size * 4, p.color, fade * 0.6);
            break;
          }
          case 'streaks': {
            const grad = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 0.12, p.y);
            grad.addColorStop(0, rgba(p.color, 0.7 * fade));
            grad.addColorStop(1, rgba(p.color, 0));
            ctx.globalAlpha = 1;
            ctx.strokeStyle = grad; ctx.lineWidth = p.size;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12); ctx.stroke();
            break;
          }
          case 'feathers': {
            ctx.save();
            ctx.translate(p.x, p.y); ctx.rotate(p.angle);
            ctx.globalAlpha = 0.85 * fade;
            ctx.drawImage(glowSprite(p.color), -p.size * 0.5, -p.size * 1.6, p.size, p.size * 3.2);
            ctx.globalAlpha = 0.5 * fade;
            ctx.drawImage(glowSprite('#ffffff'), -p.size * 0.15, -p.size * 1.2, p.size * 0.3, p.size * 2.4);
            ctx.restore();
            break;
          }
          case 'drops': {
            const behind = Math.sin(p.angle) < 0;
            ctx.globalCompositeOperation = 'source-over';
            // Estela: posiciones anteriores de la órbita, cada vez más finas.
            const cr = Math.cos(p.rot), sr = Math.sin(p.rot);
            ctx.lineCap = 'round';
            ctx.strokeStyle = p.color;
            let px = p.x, py = p.y;
            for (let j = 1; j <= 7; j++) {
              const a = p.angle - p.spin * j * 0.045;
              const ex = Math.cos(a) * p.radius, ey = Math.sin(a) * p.radius * p.tilt;
              const nx = cx() + ex * cr - ey * sr, ny = cy() + ex * sr + ey * cr + Math.sin(time * 1.3 + p.seed) * 3;
              ctx.globalAlpha = (behind ? 0.25 : 0.6) * fade * (1 - j / 8);
              ctx.lineWidth = p.size * 1.6 * (1 - j / 8);
              ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
              px = nx; py = ny;
            }
            ctx.lineCap = 'butt';
            ctx.globalAlpha = (behind ? 0.45 : 0.98) * fade;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (behind ? 0.8 : 1), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.55 * fade;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.35, p.size * 0.28, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            break;
          }
          case 'dust': {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.45 * fade;
            ctx.fillStyle = '#cbb894';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            break;
          }
          case 'frost': {
            const tw = 0.6 + Math.sin(time * 5 + p.seed) * 0.4;
            drawGlow(p.x, p.y, p.size * 2.6, p.color, 0.55 * fade * tw);
            drawGlow(p.x, p.y, p.size * 0.9, '#ffffff', 0.9 * fade * tw);
            break;
          }
          case 'cosmic': {
            const tw = 0.5 + Math.sin(time * 6 + p.seed) * 0.5;
            drawGlow(p.x, p.y, p.size * 5, p.color, fade * (0.4 + tw * 0.6));
            if (tw > 0.85) glint(p.x, p.y, p.size * 3, p.color, fade * (tw - 0.85) * 6);
            break;
          }
          default:
            drawGlow(p.x, p.y, p.size * 4.5, p.color, fade);
        }
      }

      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.life += dt;
        if (b.life >= b.max) { bolts.splice(i, 1); continue; }
        const a = (1 - b.life / b.max) * (0.7 + Math.random() * 0.3);
        ctx.globalAlpha = a;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = rgba(b.color, b.dark ? 0.6 : 0.35); ctx.lineWidth = b.width * (b.dark ? 7 : 6);
        // Los rayos negros tiemblan: cada fotograma se dibujan con un pequeño desplazamiento.
        const jit = b.dark ? 1.8 : 0;
        ctx.beginPath();
        b.pts.forEach((pt, j) => {
          const x = pt.x + (j ? rand(-jit, jit) : 0), y = pt.y + (j ? rand(-jit, jit) : 0);
          if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.stroke();
        if (b.dark) {
          // Núcleo negro sobre brillo rojo.
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#050003'; ctx.lineWidth = b.width * 1.8;
          ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
        } else {
          ctx.strokeStyle = rgba(b.color, 1); ctx.lineWidth = b.width * 2;
          ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.width * 0.7;
          ctx.stroke();
        }
      }

      // Eventos de técnica
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        e.life += dt;
        const t = e.life / e.max;
        if (t >= 1) { events.splice(i, 1); continue; }
        const out = 1 - (1 - t) * (1 - t); // easeOut
        switch (e.type) {
          case 'ripple': {
            // Barrera: onda de luz difusa, muy suave, que se expande desde la figura.
            const r = e.size * (0.25 + 0.75 * out);
            softRing(e.x, e.y, r, 0.92, 10 + 18 * t, e.color, 0.32 * (1 - t) * Math.min(1, t * 6));
            break;
          }
          case 'slash': {
            // Aparece de golpe (en ~50 ms) y se desvanece abriéndose un poco.
            const grow = Math.min(1, t / 0.12);
            const fade = t < 0.12 ? 1 : 1 - (t - 0.12) / 0.88;
            const x2 = e.x + (e.x2 - e.x) * grow, y2 = e.y + (e.y2 - e.y) * grow;
            const nx = -(e.y2 - e.y), ny = e.x2 - e.x;
            const nl = Math.hypot(nx, ny) || 1;
            const off = (2 + t * 8) * e.size;
            ctx.lineCap = 'round';
            ctx.globalAlpha = fade * 0.55;
            ctx.strokeStyle = rgba(e.color, 1); ctx.lineWidth = 12 * e.size * (1 - t * 0.5);
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6 * e.size * (1 - t * 0.6);
            ctx.stroke();
            // Segunda línea paralela, más fina: el "corte" se abre.
            ctx.globalAlpha = fade * 0.7;
            ctx.strokeStyle = rgba(e.color, 1); ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(e.x + (nx / nl) * off, e.y + (ny / nl) * off);
            ctx.lineTo(x2 + (nx / nl) * off, y2 + (ny / nl) * off);
            ctx.stroke();
            ctx.lineCap = 'butt';
            break;
          }
          case 'implode': {
            // La energía se contrae hacia el punto antes del impacto.
            const r = e.size * (1 - out);
            softRing(e.x, e.y, Math.max(2, r), 1, 6 + t * 6, e.color, 0.4 + t * 0.5);
            drawGlow(e.x, e.y, 10 + t * 18, e.color, t);
            break;
          }
          case 'vignette': {
            // Oscurece la escena un instante (o la blanquea, si el color es blanco).
            ctx.globalCompositeOperation = 'source-over';
            const fade = 1 - t;
            if (e.color === '#ffffff') {
              ctx.globalAlpha = fade * 0.22;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, W, H);
            } else {
              ctx.globalAlpha = fade * 0.55;
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, W, H);
              ctx.globalCompositeOperation = 'lighter';
              drawGlow(e.x, e.y, e.size * 0.6, e.color, fade * 0.8, true);
            }
            ctx.globalCompositeOperation = 'lighter';
            break;
          }
          case 'shock': {
            // Onda expansiva: banda de luz que se abre y se difumina.
            const r = e.size * out;
            softRing(e.x, e.y, r, 0.85, 8 + 22 * t, e.color, 0.7 * (1 - t));
            break;
          }
          case 'spot': {
            // Columna de luz que baja del techo: aparece, se mantiene y se apaga.
            const a = t < 0.3 ? t / 0.3 : t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
            const half = e.size / 2;
            const g = ctx.createLinearGradient(e.x - half, 0, e.x + half, 0);
            g.addColorStop(0, rgba(e.color, 0));
            g.addColorStop(0.5, rgba(e.color, 0.38 * a));
            g.addColorStop(1, rgba(e.color, 0));
            ctx.globalAlpha = 1;
            ctx.fillStyle = g;
            ctx.fillRect(e.x - half, 0, e.size, groundY);
            const g2 = ctx.createLinearGradient(e.x - half * 0.25, 0, e.x + half * 0.25, 0);
            g2.addColorStop(0, 'rgba(255,255,255,0)');
            g2.addColorStop(0.5, `rgba(255,255,255,${0.35 * a})`);
            g2.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g2;
            ctx.fillRect(e.x - half * 0.25, 0, half * 0.5, groundY);
            break;
          }
          case 'beam': {
            const fade = 1 - t;
            ctx.lineCap = 'round';
            ctx.globalAlpha = fade * 0.4;
            ctx.strokeStyle = rgba(e.color, 1); ctx.lineWidth = 10 * fade + 2;
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke();
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#ffe1e6'; ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.lineCap = 'butt';
            break;
          }
          case 'pulse': {
            // Latido de energía: resplandor que se expande desde el centro de la figura.
            const r = e.size * out;
            softRing(e.x, e.y, r, 0.9, 14 + 30 * t, e.color, 0.45 * (1 - t));
            drawGlow(e.x, e.y, e.size * 0.35 * (1 + t), e.color, 0.25 * (1 - t), true);
            break;
          }
          case 'star': {
            // Destello de lente sobre el contorno (filo, metal, luz).
            const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
            glint(e.x, e.y, e.size * 0.55, e.color, fade);
            break;
          }
          case 'flash':
            drawGlow(e.x, e.y, e.size * (1 + t * 0.8), e.color, 1 - t);
            break;
          case 'crack': {
            if (!e.pts) break;
            const n = Math.max(2, Math.ceil(e.pts.length * Math.min(1, t / 0.25)));
            const a = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            e.pts.slice(0, n).forEach((pt, j) => (j ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
            ctx.globalAlpha = 0.5 * a;
            ctx.strokeStyle = rgba(e.color, 1); ctx.lineWidth = 6;
            ctx.stroke();
            ctx.globalAlpha = a;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
            ctx.stroke();
            break;
          }
        }
      }

      // Luz que recorre el contorno de la figura (análisis), dos cabezas en sentidos opuestos.
      if (has('scan') && traced.length > 20) {
        const n = traced.length;
        const tail = Math.max(8, Math.floor(n * 0.09));
        const speed = 0.11; // vueltas por segundo
        for (const dir of [1, -1]) {
          const head = (((time * speed * dir) % 1) + 1) % 1 * n + (dir < 0 ? n / 2 : 0);
          for (let j = 0; j < tail; j++) {
            const idx = Math.floor(((head - dir * j) % n + n) % n);
            const p = traced[idx];
            const f = 1 - j / tail;
            drawGlow(p.x, p.y, (j === 0 ? 7 : 3.2) * f + 1, j < 3 ? '#ffffff' : accent, 0.75 * f * f);
          }
        }
      }

      // Seis gemas de colores en órbita; cada cierto tiempo destellan a la vez.
      if (has('stones')) {
        stonesClock += dt;
        stonesAngle += dt * 0.7;
        const flare = stonesClock > 6 ? Math.max(0, 1 - (stonesClock - 6) / 0.8) : 0;
        if (stonesClock > 6 && stonesClock - dt <= 6) {
          ev({ type: 'flash', x: cx(), y: cy(), size: 140 * k, max: 0.8, color: '#ffffff' });
          ev({ type: 'pulse', x: cx(), y: cy(), size: W * 0.95, max: 1.2, color: '#ffd23f' });
          impactRef.current?.(0.8);
        }
        if (stonesClock > 6.8) stonesClock = 0;
        STONE_COLORS.forEach((col, i) => {
          const a = stonesAngle + (i / STONE_COLORS.length) * Math.PI * 2;
          const r = W * (0.33 + (i % 2) * 0.05);
          const x = cx() + Math.cos(a) * r;
          const y = cy() + Math.sin(a) * r * 0.32;
          const behind = Math.sin(a) < 0;
          drawGlow(x, y, (12 + flare * 22) * k, col, (behind ? 0.5 : 0.95));
          drawGlow(x, y, 3.5 * k, '#ffffff', behind ? 0.5 : 0.9);
        });
      }

      // Orbes de dos colores que se fusionan
      if (has('orbs')) {
        orbClock += dt;
        const t = orbClock / ORB_PERIOD;
        const R = W * 0.34;
        if (t < 0.9) {
          const converge = t < 0.72 ? 0 : (t - 0.72) / 0.18;
          orbAngle += dt * (1.3 + converge * 6);
          const r = R * (1 - converge * converge);
          const orbsDef: [number, string][] = [[orbAngle, accent], [orbAngle + Math.PI, RED_ORB]];
          for (const [ang, col] of orbsDef) {
            const ox = cx() + Math.cos(ang) * r;
            const oy = cy() + Math.sin(ang) * r * 0.35;
            for (let j = 1; j <= 4; j++) {
              const pa = ang - j * 0.12;
              drawGlow(cx() + Math.cos(pa) * r, cy() + Math.sin(pa) * r * 0.35, (14 - j * 2) * k, col, 0.25);
            }
            drawGlow(ox, oy, 26 * k * (1 + converge * 0.4), col, 0.95);
            drawGlow(ox, oy, 7 * k, '#ffffff', 0.9);
          }
        } else if (!orbFired) {
          orbFired = true;
          ev({ type: 'flash', x: cx(), y: cy(), size: 120 * k, max: 0.7, color: PURPLE });
          ev({ type: 'pulse', x: cx(), y: cy(), size: W * 0.9, max: 1.1, color: PURPLE });
          for (let i = 0; i < 40; i++) {
            const p = spawn('cosmic');
            p.x = cx(); p.y = cy();
            const a = rand(0, Math.PI * 2), sp = rand(60, 220);
            p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp * 0.6;
            p.color = pick([PURPLE, '#d9b8ff', '#ffffff']);
            particles.push(p);
          }
        }
        if (t >= 1.15) { orbClock = 0; orbFired = false; }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [effects, accent, accent2, intensity, silhouette, framing]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
