import { unzipSync } from 'fflate';
import { imageDb } from '../data/db';
import { companionKey, imageKey, routeByNumber, type RouteId } from './routes';

const MAX_SIDE = 1600;
const IMAGE_RE = /\.(png|webp)$/i;

export interface ImportReport {
  imported: string[]; // claves "ruta-nivel"
  skipped: string[];  // nombres de archivo ignorados, con motivo
}

/** Número de nivel a partir del nombre de archivo: "3.png", "nivel-03.png", "ruta1-nivel10.png"… */
function levelFromFileName(name: string): number | null {
  const base = name.split('/').pop() ?? name;
  const nums = base.replace(IMAGE_RE, '').match(/\d+/g);
  if (!nums) return null;
  const n = parseInt(nums[nums.length - 1], 10);
  return n >= 1 && n <= 10 ? n : null;
}

/** Ruta a partir de la carpeta ("Ruta 1 Stark/3.png") o del prefijo ("ruta2-nivel05.png"). */
function routeFromPath(path: string): RouteId | null {
  const m = path.match(/ruta[\s_-]*(\d)/i);
  if (!m) return null;
  return routeByNumber(parseInt(m[1], 10))?.id ?? null;
}

/** Reduce imágenes enormes para que la app vaya fluida. Mantiene la transparencia (PNG). */
async function downscale(blob: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale >= 1) {
      bmp.close();
      return blob;
    }
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    return out ?? blob;
  } catch {
    return blob;
  }
}

async function store(route: RouteId, level: number, data: Blob, report: ImportReport) {
  const small = await downscale(data);
  await imageDb.put(imageKey(route, level), small);
  report.imported.push(imageKey(route, level));
}

/** Importa un ZIP con las carpetas "Ruta 1 …", "Ruta 2 …", "Ruta 3 …" y archivos 1.png…10.png. */
export async function importZip(file: File, fallbackRoute: RouteId | null): Promise<ImportReport> {
  const report: ImportReport = { imported: [], skipped: [] };
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (f) => IMAGE_RE.test(f.name) && !f.name.includes('__MACOSX')
  });
  for (const [path, bytes] of Object.entries(entries)) {
    const route = routeFromPath(path) ?? fallbackRoute;
    const level = levelFromFileName(path);
    if (!route) { report.skipped.push(`${path} (no sé de qué ruta es)`); continue; }
    if (!level) { report.skipped.push(`${path} (el nombre no tiene un número del 1 al 10)`); continue; }
    const type = /\.webp$/i.test(path) ? 'image/webp' : 'image/png';
    await store(route, level, new Blob([bytes as unknown as BlobPart], { type }), report);
  }
  return report;
}

/** Importa PNG sueltos para una ruta concreta (nivel según el número del nombre). */
export async function importFiles(files: File[], route: RouteId): Promise<ImportReport> {
  const report: ImportReport = { imported: [], skipped: [] };
  for (const file of files) {
    if (!IMAGE_RE.test(file.name)) { report.skipped.push(`${file.name} (no es PNG ni WebP)`); continue; }
    const level = levelFromFileName(file.name);
    if (!level) { report.skipped.push(`${file.name} (el nombre no tiene un número del 1 al 10)`); continue; }
    await store(routeFromPath(file.name) ?? route, level, file, report);
  }
  return report;
}

/** Guarda la figura de fondo (aparición detrás del personaje) de un nivel. */
export async function importCompanion(file: File, route: RouteId, level: number): Promise<void> {
  await imageDb.put(companionKey(route, level), await downscale(file));
}

/** Sustituye la imagen de un nivel concreto. */
export async function importSingle(file: File, route: RouteId, level: number): Promise<void> {
  await imageDb.put(imageKey(route, level), await downscale(file));
}
