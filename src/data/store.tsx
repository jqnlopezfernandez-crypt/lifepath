import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { kv, imageDb } from './db';
import { getRoute, imageKey, type Framing, type LevelConfig, type RouteId } from '../characters/routes';
import { levelForXp } from '../characters/xp';
import type { LightPoint } from '../characters/silhouette';

export interface LevelOverride {
  name?: string;
  zoom?: number;
  focusX?: number;
  focusY?: number;
  accent?: string;
  accent2?: string;
  lights?: LightPoint[];
}

export interface Settings {
  userName: string;
  activeRoute: RouteId;
  xp: number;
  /** Solo para probar el aspecto de cada nivel. No toca la XP real. */
  previewLevel: number | null;
  /** Muestra en Inicio un selector rápido de ruta y nivel. */
  testMode: boolean;
  reduceMotion: boolean;
  /** Ajustes manuales por nivel (siempre tienen prioridad). */
  overrides: Record<string, LevelOverride>;
  /** Encuadre calculado automáticamente al importar cada imagen. */
  autoFraming: Record<string, Framing>;
}

const DEFAULTS: Settings = {
  userName: 'Joaquín',
  activeRoute: 'ruta1',
  xp: 0,
  previewLevel: null,
  testMode: false,
  reduceMotion: false,
  overrides: {},
  autoFraming: {}
};

/** Datos que se guardan en la copia de ajustes (sin XP ni imágenes). */
export type SettingsBackup = Pick<Settings, 'userName' | 'activeRoute' | 'overrides' | 'autoFraming' | 'reduceMotion'> & {
  app: 'lifepath';
  kind: 'ajustes';
  version: 1;
  ruta1Order: 'cronologico';
};

interface Store {
  ready: boolean;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  setOverride: (key: string, patch: LevelOverride) => void;
  resetOverride: (key: string) => void;
  setAutoFraming: (entries: Record<string, Framing>) => void;
  exportSettings: () => SettingsBackup;
  importSettings: (data: unknown) => boolean;
  /** URLs de objeto de las imágenes importadas, por clave "ruta-nivel". */
  images: Record<string, string>;
  reloadImages: () => Promise<void>;
  /** Nivel que se muestra (vista previa o el real). */
  shownLevel: number;
  realLevel: number;
  resolveLevel: (route: RouteId, level: number) => LevelConfig;
  reducedMotion: boolean;
}

const Ctx = createContext<Store | null>(null);

/**
 * Migración única: la Ruta 1 pasó a orden cronológico (Mark XLII al 6, Hulkbuster al 7).
 * Intercambia las imágenes ya importadas y sus ajustes para que nada se pierda.
 */
async function migrateRuta1Chronological(s: Settings): Promise<Settings> {
  const FLAG = 'migr-ruta1-cronologica';
  if (await kv.get<boolean>(FLAG)) return s;
  const a = 'ruta1-6', b = 'ruta1-7';
  const [imgA, imgB] = await Promise.all([imageDb.get(a), imageDb.get(b)]);
  if (imgA) await imageDb.put(b, imgA); else await imageDb.del(b);
  if (imgB) await imageDb.put(a, imgB); else await imageDb.del(a);
  const swap = <T,>(rec: Record<string, T>) => {
    const next = { ...rec };
    delete next[a]; delete next[b];
    if (rec[a] !== undefined) next[b] = rec[a];
    if (rec[b] !== undefined) next[a] = rec[b];
    return next;
  };
  const migrated = { ...s, overrides: swap(s.overrides), autoFraming: swap(s.autoFraming) };
  await kv.set('settings', migrated);
  await kv.set(FLAG, true);
  return migrated;
}

function useSystemReducedMotion(): boolean {
  const [v, setV] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setV(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return v;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [images, setImages] = useState<Record<string, string>>({});
  const urlsRef = useRef<Record<string, string>>({});
  const systemReduced = useSystemReducedMotion();

  const reloadImages = useCallback(async () => {
    const keys = (await imageDb.keys()).map(String);
    const next: Record<string, string> = {};
    for (const key of keys) {
      const blob = await imageDb.get(key);
      if (blob) next[key] = URL.createObjectURL(blob);
    }
    Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = next;
    setImages(next);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await kv.get<Partial<Settings>>('settings');
        let loaded: Settings = { ...DEFAULTS, ...(saved ?? {}) };
        loaded = await migrateRuta1Chronological(loaded);
        setSettings(loaded);
        await reloadImages();
      } catch (err) {
        console.error('No se pudieron cargar los datos locales', err);
      } finally {
        setReady(true);
      }
    })();
  }, [reloadImages]);

  const persist = useCallback((s: Settings) => {
    kv.set('settings', s).catch((err) => console.error('No se pudieron guardar los ajustes', err));
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      }),
    [persist]
  );

  const setOverride = useCallback(
    (key: string, patch: LevelOverride) =>
      setSettings((prev) => {
        const next = { ...prev, overrides: { ...prev.overrides, [key]: { ...prev.overrides[key], ...patch } } };
        persist(next);
        return next;
      }),
    [persist]
  );

  const resetOverride = useCallback(
    (key: string) =>
      setSettings((prev) => {
        const overrides = { ...prev.overrides };
        delete overrides[key];
        const next = { ...prev, overrides };
        persist(next);
        return next;
      }),
    [persist]
  );

  const setAutoFraming = useCallback(
    (entries: Record<string, Framing>) =>
      setSettings((prev) => {
        const next = { ...prev, autoFraming: { ...prev.autoFraming, ...entries } };
        persist(next);
        return next;
      }),
    [persist]
  );

  const exportSettings = useCallback((): SettingsBackup => ({
    app: 'lifepath', kind: 'ajustes', version: 1, ruta1Order: 'cronologico',
    userName: settings.userName,
    activeRoute: settings.activeRoute,
    overrides: settings.overrides,
    autoFraming: settings.autoFraming,
    reduceMotion: settings.reduceMotion
  }), [settings]);

  const importSettings = useCallback(
    (data: unknown): boolean => {
      const d = data as (Partial<SettingsBackup> & { ruta1Order?: string }) | null;
      if (!d || d.app !== 'lifepath' || d.kind !== 'ajustes' || typeof d.overrides !== 'object') return false;
      // Copias hechas antes del orden cronológico: intercambia los niveles 6 y 7 de la Ruta 1.
      if (d.ruta1Order !== 'cronologico') {
        const sw = <T,>(rec: Record<string, T> | undefined) => {
          if (!rec) return rec;
          const next = { ...rec };
          delete next['ruta1-6']; delete next['ruta1-7'];
          if (rec['ruta1-6'] !== undefined) next['ruta1-7'] = rec['ruta1-6'];
          if (rec['ruta1-7'] !== undefined) next['ruta1-6'] = rec['ruta1-7'];
          return next;
        };
        d.overrides = sw(d.overrides);
        d.autoFraming = sw(d.autoFraming);
      }
      setSettings((prev) => {
        const next: Settings = {
          ...prev,
          userName: typeof d.userName === 'string' ? d.userName : prev.userName,
          activeRoute: d.activeRoute === 'ruta1' || d.activeRoute === 'ruta2' || d.activeRoute === 'ruta3' ? d.activeRoute : prev.activeRoute,
          overrides: { ...prev.overrides, ...(d.overrides ?? {}) },
          autoFraming: { ...prev.autoFraming, ...(d.autoFraming ?? {}) },
          reduceMotion: typeof d.reduceMotion === 'boolean' ? d.reduceMotion : prev.reduceMotion
        };
        persist(next);
        return next;
      });
      return true;
    },
    [persist]
  );

  const resolveLevel = useCallback(
    (route: RouteId, level: number): LevelConfig => {
      const key = imageKey(route, level);
      const base = getRoute(route).levels[level - 1];
      const o = settings.overrides[key];
      const auto = settings.autoFraming[key];
      if (!o && !auto) return base;
      const fr = auto ?? base.framing;
      return {
        ...base,
        name: o?.name?.trim() ? o.name : base.name,
        accent: o?.accent ?? base.accent,
        accent2: o?.accent2 ?? base.accent2,
        lights: o?.lights ?? base.lights,
        framing: {
          zoom: o?.zoom ?? fr.zoom,
          focusX: o?.focusX ?? fr.focusX,
          focusY: o?.focusY ?? fr.focusY
        }
      };
    },
    [settings.overrides, settings.autoFraming]
  );

  const realLevel = levelForXp(settings.xp);
  const shownLevel = settings.previewLevel ?? realLevel;

  const value = useMemo<Store>(
    () => ({
      ready,
      settings,
      update,
      setOverride,
      resetOverride,
      setAutoFraming,
      exportSettings,
      importSettings,
      images,
      reloadImages,
      shownLevel,
      realLevel,
      resolveLevel,
      reducedMotion: systemReduced || settings.reduceMotion
    }),
    [ready, settings, update, setOverride, resetOverride, setAutoFraming, exportSettings, importSettings, images, reloadImages, shownLevel, realLevel, resolveLevel, systemReduced]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fuera de AppStoreProvider');
  return s;
}
