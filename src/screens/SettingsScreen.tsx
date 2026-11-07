import { useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { ROUTES, companionKey, getRoute, imageKey, type Framing, type RouteId } from '../characters/routes';
import { analyzeImage, autoFraming, detectBrightSpots, stageToImage } from '../characters/silhouette';
import { useSilhouette } from '../characters/useSilhouette';
import { importCompanion, importFiles, importSingle, importZip, type ImportReport } from '../characters/imageImport';
import { CharacterStage } from '../characters/CharacterStage';
import { imageDb } from '../data/db';
import { Icon } from '../components/Icon';

/** Calcula el encuadre automático de la imagen guardada para un nivel. */
async function computeAuto(key: string): Promise<Framing | null> {
  const blob = await imageDb.get(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  try {
    const sil = await analyzeImage(url);
    return sil ? autoFraming(sil) : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SettingsScreen() {
  const { settings, update, images, reloadImages, resolveLevel, setOverride, resetOverride, setAutoFraming, exportSettings, importSettings } = useStore();
  const backupRef = useRef<HTMLInputElement>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [importRoute, setImportRoute] = useState<RouteId>(settings.activeRoute);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editRoute, setEditRoute] = useState<RouteId>(settings.activeRoute);
  const [editLevel, setEditLevel] = useState(1);
  const zipRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const singleRef = useRef<HTMLInputElement>(null);

  const run = async (job: () => Promise<ImportReport | void>) => {
    setBusy(true); setError(null); setReport(null);
    try {
      const r = await job();
      if (r) {
        setReport(r);
        // Encuadre automático para lo recién importado (no toca tus ajustes manuales).
        const entries: Record<string, Framing> = {};
        for (const k of r.imported) {
          const fr = await computeAuto(k);
          if (fr) entries[k] = fr;
        }
        setAutoFraming(entries);
      }
      await reloadImages();
    } catch (err) {
      console.error(err);
      setError('No se pudo importar. Comprueba que el archivo sea un ZIP o PNG válido.');
    } finally {
      setBusy(false);
    }
  };

  const onZip = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) run(() => importZip(f, null));
  };
  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (list.length) run(() => importFiles(list, importRoute));
  };
  const onSingle = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    const k = imageKey(editRoute, editLevel);
    if (f) run(async () => {
      await importSingle(f, editRoute, editLevel);
      // Imagen nueva: los ajustes de la anterior (encuadre, puntos de luz) ya no sirven.
      resetOverride(k);
      return { imported: [k], skipped: [] };
    });
  };

  // ── Figura de fondo ──
  const companionRef = useRef<HTMLInputElement>(null);
  const cKey = companionKey(editRoute, editLevel);
  const onCompanion = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) run(async () => { await importCompanion(f, editRoute, editLevel); });
  };

  // ── Puntos de luz ──
  const key = imageKey(editRoute, editLevel);
  const cfg = resolveLevel(editRoute, editLevel);
  const editSil = useSilhouette(images[key]);
  const lights = cfg.lights ?? [];
  const [placing, setPlacing] = useState(false);

  const detectLights = async () => {
    const src = images[key];
    if (!src) return;
    const found = await detectBrightSpots(src);
    setOverride(key, { lights: found });
  };

  const onPreviewTap = (e: MouseEvent<HTMLDivElement>) => {
    if (!placing || !editSil) return;
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const { u, v } = stageToImage(editSil, cfg.framing, r.width, r.height, e.clientX - r.left, e.clientY - r.top);
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    const near = lights.findIndex((l) => Math.hypot(l.u - u, (l.v - v) * (editSil.ih / editSil.iw)) < 0.04);
    if (near >= 0) setOverride(key, { lights: lights.filter((_, i) => i !== near) });
    else setOverride(key, { lights: [...lights, { u, v, size: lights[0]?.size ?? 5, color: lights[0]?.color ?? cfg.accent }] });
  };

  const applyAuto = async (k: string) => {
    const fr = await computeAuto(k);
    if (fr) setOverride(k, { zoom: fr.zoom, focusX: fr.focusX, focusY: fr.focusY });
  };

  const applyAutoRoute = async (id: RouteId) => {
    if (!window.confirm('Esto sustituye los encuadres manuales de toda la ruta por el automático. ¿Seguir?')) return;
    setBusy(true);
    try {
      for (const l of getRoute(id).levels) {
        const k = imageKey(id, l.level);
        if (!images[k]) continue;
        const fr = await computeAuto(k);
        if (fr) setOverride(k, { zoom: fr.zoom, focusX: fr.focusX, focusY: fr.focusY });
      }
    } finally {
      setBusy(false);
    }
  };

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportSettings(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifepath-ajustes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setBackupMsg('Copia creada. Guárdala en Archivos o iCloud Drive.');
  };

  const onBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const ok = importSettings(JSON.parse(await f.text()));
      setBackupMsg(ok ? 'Ajustes restaurados.' : 'Ese archivo no es una copia de ajustes de LIFEPATH.');
    } catch {
      setBackupMsg('No se pudo leer el archivo.');
    }
  };

  const countFor = (id: RouteId) => getRoute(id).levels.filter((l) => images[imageKey(id, l.level)]).length;

  return (
    <>
      <span className="eyebrow">LIFEPATH</span>
      <h1 className="title">Ajustes</h1>

      <Section title="Perfil">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Nombre</span>
          <input
            value={settings.userName}
            onChange={(e) => update({ userName: e.target.value })}
            style={{ minHeight: 48, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface-2)', padding: '0 14px', fontSize: 16 }}
          />
        </label>
      </Section>

      <Section title="Ruta activa" note="Cambiar de ruta no altera tu XP: el nivel es el mismo en las tres.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ROUTES.map((r) => (
            <button key={r.id} type="button" className="chip" aria-pressed={settings.activeRoute === r.id} onClick={() => update({ activeRoute: r.id })}>
              {r.name}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Importar personajes"
        note="Las imágenes se guardan solo en este dispositivo. Usa un ZIP con las carpetas «Ruta 1 …», «Ruta 2 …», «Ruta 3 …» y archivos 1.png a 10.png."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => zipRef.current?.click()}>
            <Icon name="upload" size={20} /> {busy ? 'Importando…' : 'Importar ZIP con las tres rutas'}
          </button>
          <input ref={zipRef} type="file" accept=".zip,application/zip" hidden onChange={onZip} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>O PNG sueltos para:</span>
            {ROUTES.map((r) => (
              <button key={r.id} type="button" className="chip" aria-pressed={importRoute === r.id} onClick={() => setImportRoute(r.id)}>
                Ruta {r.number}
              </button>
            ))}
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => filesRef.current?.click()}>
            Elegir PNG de la ruta {getRoute(importRoute).number}
          </button>
          <input ref={filesRef} type="file" accept="image/png,image/webp" multiple hidden onChange={onFiles} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            {ROUTES.map((r) => (
              <div key={r.id} className="panel" style={{ padding: 10, borderRadius: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ruta {r.number}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{countFor(r.id)} / 10</div>
              </div>
            ))}
          </div>

          {report && (
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Importadas: {report.imported.length}.
              {report.skipped.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--warm)' }}>
                  {report.skipped.map((s) => <li key={s}>{s}</li>)}
                </ul>
              )}
            </div>
          )}
          {error && <div style={{ fontSize: 13, color: '#ff8a8a' }}>{error}</div>}
        </div>
      </Section>

      <Section title="Encuadre por nivel" note="Iguala el aspecto de todas las imágenes sin modificarlas.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ROUTES.map((r) => (
            <button key={r.id} type="button" className="chip" aria-pressed={editRoute === r.id} onClick={() => setEditRoute(r.id)}>
              Ruta {r.number}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '10px 0', paddingBottom: 4 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={editLevel === n} onClick={() => setEditLevel(n)} style={{ minWidth: 44, padding: 0 }}>
              {n}
            </button>
          ))}
        </div>

        <div
          className="panel"
          onClickCapture={onPreviewTap}
          style={{ height: 320, borderRadius: 18, overflow: 'hidden', position: 'relative', outline: placing ? '2px solid var(--accent)' : 'none' }}
        >
          <CharacterStage route={editRoute} level={editLevel} className="fill" />
          {placing && (
            <span style={{ position: 'absolute', left: 10, top: 10, fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 999, background: 'rgba(0,0,0,.6)' }}>
              Toca para añadir o quitar un punto de luz
            </span>
          )}
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Puntos de luz ({lights.length}) — brillos que laten sobre ojos, núcleos de energía o lo que quieras
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <button type="button" className="btn" disabled={!images[key]} onClick={detectLights}>Detectar</button>
            <button type="button" className="btn" disabled={!images[key]} aria-pressed={placing} onClick={() => setPlacing((p) => !p)} style={placing ? { borderColor: 'var(--accent)' } : undefined}>
              {placing ? 'Listo' : 'Colocar'}
            </button>
            <button type="button" className="btn" disabled={!lights.length} onClick={() => setOverride(key, { lights: [] })}>Borrar</button>
          </div>
          {lights.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
              <Slider label="Tamaño de los puntos" value={lights[0].size} min={1} max={16} step={0.5} format={(v) => `${v.toFixed(1)} %`} onChange={(v) => setOverride(key, { lights: lights.map((l) => ({ ...l, size: v })) })} />
              <input type="color" aria-label="Color de los puntos" value={lights[0].color} onChange={(e) => setOverride(key, { lights: lights.map((l) => ({ ...l, color: e.target.value })) })} style={{ width: 44, height: 44, border: 'none', background: 'none', padding: 0 }} />
            </div>
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Nombre del nivel</span>
          <input
            value={settings.overrides[key]?.name ?? cfg.name}
            onChange={(e) => setOverride(key, { name: e.target.value })}
            style={{ minHeight: 48, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface-2)', padding: '0 14px', fontSize: 16 }}
          />
        </label>
        <Slider label="Zoom" value={cfg.framing.zoom} min={0.6} max={4} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => setOverride(key, { zoom: v })} />
        <Slider label="Posición vertical" value={cfg.framing.focusY} min={-40} max={140} step={1} format={(v) => `${Math.round(v)} %`} onChange={(v) => setOverride(key, { focusY: v })} />
        <Slider label="Posición horizontal" value={cfg.framing.focusX} min={-40} max={140} step={1} format={(v) => `${Math.round(v)} %`} onChange={(v) => setOverride(key, { focusX: v })} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <ColorField label="Color principal" value={cfg.accent} onChange={(v) => setOverride(key, { accent: v })} />
          <ColorField label="Color secundario" value={cfg.accent2} onChange={(v) => setOverride(key, { accent2: v })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn" disabled={!images[key]} onClick={() => applyAuto(key)}>Encuadre automático</button>
          <button type="button" className="btn" onClick={() => resetOverride(key)}>Restablecer</button>
          <button type="button" className="btn" disabled={busy} onClick={() => singleRef.current?.click()}>Cambiar imagen</button>
          <button type="button" className="btn" disabled={busy} onClick={() => applyAutoRoute(editRoute)}>Auto en toda la ruta</button>
        </div>
        <input ref={singleRef} type="file" accept="image/png,image/webp" hidden onChange={onSingle} />
        {images[key] && (
          <button
            type="button"
            className="btn"
            style={{ width: '100%', marginTop: 8, color: '#ff9b9b' }}
            onClick={async () => { await imageDb.del(key); await reloadImages(); }}
          >
            Quitar imagen de este nivel
          </button>
        )}

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
            Figura de fondo — una segunda imagen que aparece detrás del personaje como una presencia fantasmal, oscura y translúcida.
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: images[cKey] ? '1fr 1fr' : '1fr', gap: 8 }}>
            <button type="button" className="btn" disabled={busy} onClick={() => companionRef.current?.click()}>
              {images[cKey] ? 'Cambiar figura de fondo' : 'Añadir figura de fondo'}
            </button>
            {images[cKey] && (
              <button
                type="button"
                className="btn"
                style={{ color: '#ff9b9b' }}
                onClick={async () => { await imageDb.del(cKey); await reloadImages(); }}
              >
                Quitar
              </button>
            )}
          </div>
          <input ref={companionRef} type="file" accept="image/png,image/webp" hidden onChange={onCompanion} />
        </div>
      </Section>

      <Section title="Modo prueba" note="Muestra en Inicio un selector de ruta y nivel para ver cualquier personaje al momento. No cambia tu XP.">
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
          <span style={{ fontSize: 15 }}>Selector de niveles en Inicio</span>
          <input type="checkbox" checked={settings.testMode} onChange={(e) => update({ testMode: e.target.checked, previewLevel: e.target.checked ? settings.previewLevel : null })} style={{ width: 24, height: 24, accentColor: 'var(--accent)' }} />
        </label>
      </Section>

      <Section
        title="Copia de ajustes"
        note="Guarda tus encuadres, nombres y colores en un archivo. Úsalo para no repetirlos al pasar a la versión publicada o cambiar de móvil. Las imágenes se importan aparte."
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="btn" onClick={doExport}>Exportar</button>
          <button type="button" className="btn" onClick={() => backupRef.current?.click()}>Restaurar</button>
        </div>
        <input ref={backupRef} type="file" accept="application/json,.json" hidden onChange={onBackup} />
        {backupMsg && <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '10px 0 0' }}>{backupMsg}</p>}
      </Section>

      <Section title="Vista previa de niveles" note="Solo para ver cómo luce cada nivel. No cambia tu XP ni tu progreso real.">
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button type="button" className="chip" aria-pressed={settings.previewLevel === null} onClick={() => update({ previewLevel: null })}>
            Real
          </button>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={settings.previewLevel === n} onClick={() => update({ previewLevel: n })} style={{ minWidth: 44, padding: 0 }}>
              {n}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Animaciones">
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
          <span style={{ fontSize: 15 }}>Reducir movimiento</span>
          <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} style={{ width: 24, height: 24, accentColor: 'var(--accent)' }} />
        </label>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--faint)' }}>
          También se activa solo si el iPhone tiene «Reducir movimiento» en Accesibilidad.
        </p>
      </Section>
    </>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{title}</h2>
      {note && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{note}</p>}
      {!note && <div style={{ height: 8 }} />}
      {children}
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 12px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', padding: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
    </label>
  );
}

function Slider({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text)' }}>{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}
