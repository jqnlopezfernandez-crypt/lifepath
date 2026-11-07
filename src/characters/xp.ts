// Escala de experiencia compartida por las tres rutas (XP acumulada).
export const XP_TABLE = [0, 500, 1200, 2200, 3500, 5000, 7000, 9500, 12500, 16000] as const;
export const MAX_LEVEL = XP_TABLE.length;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) level = i + 1;
  return level;
}

export interface XpProgress {
  level: number;
  current: number;      // XP total
  levelStart: number;   // XP donde empieza el nivel actual
  nextAt: number | null; // XP del siguiente nivel (null en el máximo)
  pct: number;          // 0–1 dentro del nivel
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const levelStart = XP_TABLE[level - 1];
  const nextAt = level < MAX_LEVEL ? XP_TABLE[level] : null;
  const pct = nextAt === null ? 1 : (xp - levelStart) / (nextAt - levelStart);
  return { level, current: xp, levelStart, nextAt, pct: Math.max(0, Math.min(1, pct)) };
}

export const fmt = (n: number) => n.toLocaleString('es-ES');
