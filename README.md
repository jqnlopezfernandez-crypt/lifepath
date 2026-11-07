# LIFEPATH

PWA personal de productividad y hábitos con progresión RPG. Pensada para iPhone y desarrollada desde Windows, sin Mac y sin servicios de pago.

## Estado actual: Fase 1 y sistema de personajes

- Base React + TypeScript + Vite, instalable como PWA y con funcionamiento offline.
- Navegación inferior con cinco apartados.
- **Inicio:** personaje protagonista, nivel, XP y estado vacío honesto (no inventa cifras).
- **Personaje:** galería de la ruta, niveles bloqueados y repetición de la animación de desbloqueo.
- **Ajustes:**
  - importación de personajes (ZIP o PNG sueltos);
  - encuadre por nivel con zoom y posición, y nombre editable;
  - vista previa de niveles;
  - reducir movimiento.
- **Efectos que escalan con el nivel:**

| Niveles | Efectos |
|---|---|
| 1–3 | Aura, flotación, partículas suaves |
| 4–6 | Lo anterior + rayos de luz giratorios, brillo del contorno, más partículas |
| 7–9 | Lo anterior + halo de energía, ondas en el suelo, inclinación 3D al tocar |
| 10 | Lo anterior + doble aura, doble halo, destellos periódicos, brillo que recorre la figura |

Al tocar al personaje hay una ráfaga de energía, y con rayos si el nivel los tiene.

«Mi día» y «Estadísticas» aparecen como próximamente. Llegan en las fases 2 y 6.

## Primeros pasos (Windows)

1. Instala Node.js LTS desde nodejs.org.
2. En esta carpeta, abre una terminal (o Claude Code) y ejecuta:

   ```
   npm install
   npm run dev
   ```

3. Abre la dirección `Local` en el navegador del PC.
4. Para probarlo en el iPhone dentro de la misma wifi, abre en Safari la dirección `Network` que muestra la terminal.

Antes de seguir desarrollando, comprueba que compila:

```
npm run build
```

## Publicar gratis en GitHub Pages

1. Crea un repositorio en GitHub y sube esta carpeta a la rama `main`.
2. En el repositorio, ve a *Settings → Pages → Source* y elige **GitHub Actions**.
3. Cada vez que subas cambios, se publica sola en `https://<tu-usuario>.github.io/<repo>/`.
4. En el iPhone, abre esa dirección en Safari y pulsa *Compartir → Añadir a pantalla de inicio*.

## Personajes: cómo importarlos

Las imágenes **no van en el repositorio**: GitHub Pages es público. Se importan desde la app y se guardan solo en el iPhone (IndexedDB).

1. Prepara un ZIP con tres carpetas cuyo nombre empiece por `Ruta 1`, `Ruta 2` y `Ruta 3`.
2. Dentro de cada una van los archivos `1.png` … `10.png`.
3. Sube el ZIP a iCloud Drive (en icloud.com, desde el PC).
4. En el iPhone, en LIFEPATH, ve a *Ajustes → Importar ZIP con las tres rutas* y elige el archivo.
5. Las imágenes de más de 1600 px se reducen solas.

## Limitaciones reales de iOS

- **Apple Salud:** una PWA no puede leerlo directamente. En la Fase 5 se usará un Atajo que genere un JSON con pasos, calorías y sueño, que se importa en la app con un toque.
- **Tiempo de uso:** iOS no permite leer el total diario ni con Atajos. La categoría queda preparada, sin datos inventados, y no penaliza la nota.
- **Notificaciones push:** solo funcionan con la app añadida a la pantalla de inicio (iOS 16.4 o posterior). Sin servidor no se pueden programar a una hora fija; los recordatorios con hora irán por Automatizaciones de Atajos.
- **Almacenamiento:** usa la app instalada en la pantalla de inicio. Safari puede borrar los datos de webs no instaladas que no se visitan en un tiempo. Haz copias de seguridad cuando llegue la exportación (Fase 6).
