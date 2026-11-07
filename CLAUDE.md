# Contexto para Claude Code

Proyecto personal de Joaquín (llamarle «Joaquín»). No sabe programar: explica los pasos con claridad y sin jerga innecesaria. Desarrolla en Windows 11 y usa un iPhone 17 Pro.

## Reglas del proyecto
- PWA con React, TypeScript y Vite. Sin servicios de pago, sin backend y sin Mac.
- Datos solo en local (IndexedDB, `src/data/db.ts`). Ninguna petición a servidores externos.
- **Las imágenes de personajes nunca se añaden al repositorio ni al código.** El usuario las importa desde Ajustes (ZIP o PNG) y se guardan en IndexedDB. La configuración visual de cada nivel está en `src/characters/routes.ts`.
- No inventar datos: si una categoría no tiene datos, se muestra como «sin datos» y se excluye de la nota.
- No simular integraciones de iOS que no existen (HealthKit directo, Tiempo de uso).
- Respetar «reducir movimiento» (`reducedMotion` en el store).
- Tras cada fase: `npm run build` sin errores antes de continuar.

## Mapa del código
- `src/data/store.tsx`: ajustes, XP, nivel mostrado e imágenes (URLs de objeto).
- `src/characters/`:
  - `routes.ts`: rutas, niveles, efectos y encuadres.
  - `xp.ts`: escala de XP.
  - `CharacterStage.tsx`: escenario por tiers.
  - `effects/ParticleField.tsx`: motor de partículas en canvas.
  - `LevelUpOverlay.tsx`: animación de desbloqueo.
  - `imageImport.ts`: importación ZIP y PNG con reducción a 1600 px.
- `src/screens/`: Inicio, Personaje, Ajustes. Mi día y Estadísticas están pendientes.

## Fases pendientes
- **Fase 2:** registro diario, temporizador de estudio persistente (calcular con marcas de tiempo, no con setInterval), hábitos, tareas y alimentación (1–5).
- **Fase 3:** motor de nota 1–10 con pesos y normalización de categorías ausentes, fiabilidad, calendario de exámenes, transacciones de XP con topes diarios y rachas.
- **Fase 5:** importación del JSON de un Atajo de Apple Salud, con validación y sin duplicados por fecha.
- **Fase 6:** estadísticas semanales y mensuales, notificaciones, exportación e importación de copia de seguridad (con opción de incluir imágenes).
