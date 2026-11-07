import type { LightPoint } from './silhouette';

// Configuración de las tres rutas. Aquí NO hay imágenes: el usuario las importa
// desde Ajustes y se guardan solo en su dispositivo (IndexedDB).

export type EffectKind =
  | 'embers'    // brasas que nacen del contorno y suben con turbulencia
  | 'sparks'    // chispas que saltan del contorno y rebotan en el suelo
  | 'frost'     // cristales de escarcha que flotan
  | 'shadow'    // jirones de sombra que suben desde la figura
  | 'lightning' // rayos que recorren el contorno de la figura
  | 'drops'     // gotas densas que orbitan
  | 'streaks'   // estelas de velocidad
  | 'orbit'     // motas de energía que orbitan
  | 'dust'      // polvo que se levanta del suelo
  | 'smoke'     // humo lento que se expande
  | 'feathers'  // plumas que caen girando
  | 'cosmic'    // destellos multicolor alrededor de la figura
  // ── Efectos de "técnica": eventos periódicos con más carácter ──
  | 'orbs'      // dos orbes (color 1 y 2) orbitan, convergen y estallan en violeta
  | 'ripples'   // ondas de barrera que se expanden desde la figura
  | 'slashes'   // cortes cruzados que aparecen alrededor
  | 'blackflash'// chispazo negro con brillo rojo en el contorno
  | 'beam'      // haz fino disparado desde la figura
  | 'pool'      // charco de sombra bajo los pies con jirones
  | 'pulse'     // pulso de energía desde el centro, como un latido
  | 'starburst' // destellos en estrella sobre el contorno
  | 'afterimage' // copias fantasma de la figura (velocidad)
  | 'mist'      // niebla baja que se desplaza
  | 'flames'    // lenguas de fuego que nacen del contorno
  | 'verdict'   // columna de luz que cae sobre la figura y golpe en el suelo
  | 'scan'      // luz que recorre el contorno y anillo de interfaz
  | 'hex'       // nanopartículas que se ensamblan sobre la silueta
  | 'stomp'     // pisotón: onda en el suelo, polvo y sacudida
  | 'stones'    // seis gemas de colores en órbita que destellan a la vez
  | 'dual'      // fuego en el lado derecho, hielo en el izquierdo
  | 'explosions'// explosiones en el contorno con humo y chispas
  | 'decay'     // fragmentos que se desintegran desde la figura
  | 'cracks';   // grietas de energía que se abren por el suelo

/** Cómo se mueve la figura en reposo. */
export type MotionStyle =
  | 'calm'    // respiración suave
  | 'hover'   // suspendido en el aire, balanceo amplio
  | 'heavy'   // respiración pesada anclada al suelo
  | 'agile'   // balanceo rápido, listo para atacar
  | 'menace'  // inclinación lenta y amenazante
  | 'warp';   // la figura se deforma levemente, inestable

/** Tipo de aura que abraza la silueta. */
export type AuraStyle =
  | 'glow'     // resplandor limpio
  | 'fire'     // aura que sube y ondula como llamas
  | 'electric' // aura que parpadea con cortes
  | 'dark'     // aura oscura y humeante
  | 'divine';  // aura brillante con pulsos de luz

export interface Framing {
  zoom: number;   // 1 = imagen completa
  focusX: number; // %, punto hacia el que se hace zoom
  focusY: number; // %
}

export interface LevelConfig {
  level: number;
  name: string;
  accent: string;
  accent2: string;
  effects: EffectKind[];
  motion: MotionStyle;
  aura: AuraStyle;
  /** Reflejo de luz que recorre la figura (ideal para armaduras metálicas). */
  sweep: boolean;
  framing: Framing;
  /** Puntos de luz colocados por el usuario (ojos, núcleos de energía…). */
  lights?: LightPoint[];
}

export type RouteId = 'ruta1' | 'ruta2' | 'ruta3';

export interface RouteConfig {
  id: RouteId;
  number: 1 | 2 | 3;
  name: string;
  levels: LevelConfig[];
}

const f = (zoom: number, focusY: number, focusX = 50): Framing => ({ zoom, focusX, focusY });

const L = (
  level: number,
  name: string,
  accent: string,
  accent2: string,
  effects: EffectKind[],
  motion: MotionStyle,
  aura: AuraStyle,
  sweep: boolean,
  framing: Framing
): LevelConfig => ({ level, name, accent, accent2, effects, motion, aura, sweep, framing });

export const ROUTES: RouteConfig[] = [
  {
    id: 'ruta1',
    number: 1,
    name: 'Ruta Stark',
    levels: [
      // Orden cronológico de las películas.
      // El genio: escaneo holográfico y motas de datos a su alrededor.
      L(1, 'Tony Stark', '#9fd8ff', '#5cc8ff', ['scan', 'orbit'], 'calm', 'glow', false, f(1.0, 50)),
      // Hecha en una cueva: chispas de soldadura y humo, metal pesado.
      L(2, 'Mark I', '#c9d0dd', '#ffb067', ['sparks', 'smoke'], 'heavy', 'glow', true, f(2.4, 15)),
      // La primera de verdad: calor de los propulsores y escaneo del sistema.
      L(3, 'Mark III', '#ff5a4f', '#ffc857', ['embers', 'scan'], 'hover', 'fire', true, f(2.5, 12)),
      // La armadura maletín: destellos de montaje y chispas.
      L(4, 'Mark V', '#e6ebf2', '#ff5a4f', ['starburst', 'sparks', 'scan'], 'agile', 'glow', true, f(1.4, 20)),
      // El nuevo reactor: pulso de energía cian, como un latido.
      L(5, 'Mark VI', '#5ce1ff', '#ff5a4f', ['pulse', 'orbit', 'sparks'], 'hover', 'electric', true, f(2.4, 12)),
      // Piezas que vuelan solas: chispas doradas, estelas y destellos.
      L(6, 'Mark XLII', '#ffc857', '#ff5a4f', ['sparks', 'streaks', 'starburst'], 'hover', 'divine', true, f(2.5, 12)),
      // El tanque: pisotones que sacuden el suelo, polvo y brasas.
      L(7, 'Hulkbuster', '#e0413a', '#ffb067', ['stomp', 'embers', 'sparks'], 'heavy', 'fire', true, f(2.0, 15)),
      // Nanotecnología: partículas que se ensamblan sobre la armadura, y rayos.
      L(8, 'Mark L', '#5ce1ff', '#b0283a', ['hex', 'lightning', 'orbit'], 'calm', 'electric', true, f(2.4, 10)),
      // La definitiva: nanotecnología, energía y estelas de vuelo.
      L(9, 'Mark LXXXV', '#ffc857', '#5ce1ff', ['hex', 'embers', 'lightning', 'streaks'], 'hover', 'divine', true, f(2.0, 15)),
      // El final: seis gemas en órbita que destellan a la vez, energía cósmica.
      L(10, 'Tony Stark — Endgame', '#ffd166', '#b28dff', ['stones', 'cosmic', 'lightning'], 'menace', 'divine', true, f(1.15, 35))
    ]
  },
  {
    id: 'ruta2',
    number: 2,
    name: 'Ruta Jujutsu',
    levels: [
      // Sombras: niebla oscura que se arrastra alrededor.
      L(1, 'Megumi Fushiguro', '#7b7dff', '#1c1d4a', ['mist'], 'calm', 'dark', false, f(1.0, 50)),
      // Golpes: chispazos negros con brillo rojo y polvo de impacto.
      L(2, 'Yuji Itadori', '#ff2e3f', '#1a0306', ['blackflash', 'dust', 'sparks'], 'agile', 'fire', false, f(1.3, 10)),
      // Velocidad por fotogramas: copias fantasma y estelas.
      L(3, "Naoya Zen'in", '#c6f36b', '#7fe3b8', ['afterimage', 'streaks'], 'agile', 'electric', false, f(1.2, 10)),
      // Sangre: anillos de gotas en órbita, con estela.
      L(4, 'Choso', '#d1243b', '#5a0d18', ['drops'], 'calm', 'dark', false, f(2.0, 20)),
      // Alma inestable: la figura se deforma, humo y sombras.
      L(5, 'Mahito', '#8fb3c9', '#2a3550', ['smoke', 'shadow', 'cosmic'], 'warp', 'dark', false, f(1.6, 20)),
      // Juicio: columna de luz dorada que cae sobre él y golpe seco en el suelo, con destellos.
      L(6, 'Hiromi Higuruma', '#ffd166', '#fff4c2', ['verdict', 'starburst', 'orbit'], 'calm', 'divine', false, f(1.2, 10)),
      // Sin energía, pura velocidad: copias fantasma, estelas y destellos de filo.
      L(7, 'Toji Fushiguro', '#b8c2cf', '#6b4c7a', ['afterimage', 'streaks', 'starburst'], 'agile', 'glow', false, f(2.0, 15)),
      // Reservas enormes de energía: aura oscura con destellos blanco azulados, pulsos y brillos de filo.
      L(8, 'Yuta Okkotsu', '#bfe3ff', '#0b1030', ['pulse', 'starburst', 'smoke'], 'calm', 'dark', false, f(1.3, 12)),
      // Cortes invisibles: ráfagas de tajos que cruzan toda la pantalla; lenguas de fuego y brasas.
      L(9, 'Sukuna', '#ff2e4d', '#3b0a12', ['slashes', 'flames', 'embers'], 'menace', 'fire', false, f(2.3, 12)),
      // Barrera y técnica de los dos colores: ondas que distorsionan, orbes azul y rojo que se fusionan en violeta.
      L(10, 'Satoru Gojo', '#3fb6ff', '#b9e6ff', ['orbs', 'ripples', 'cosmic'], 'calm', 'divine', false, f(1.1, 10))
    ]
  },
  {
    id: 'ruta3',
    number: 3,
    name: 'Ruta Héroes',
    levels: [
      // Endurecimiento: reflejo metálico, chispas al impacto y destellos de dureza.
      L(1, 'Kirishima — Red Riot', '#ff5a4f', '#c9d0dd', ['sparks', 'starburst', 'dust'], 'heavy', 'glow', true, f(1.4, 15)),
      // Mitad fuego (derecha) y mitad hielo (izquierda).
      L(2, 'Shoto Todoroki', '#ff6b3d', '#7fd6ff', ['dual', 'flames', 'frost'], 'calm', 'glow', false, f(1.4, 15)),
      // Permeación: atraviesa la materia; copias fantasma y ondas al cruzar.
      L(3, 'Mirio Togata — Lemillion', '#ffd166', '#9fd8ff', ['afterimage', 'ripples', 'dust'], 'agile', 'glow', false, f(1.4, 15)),
      // Alas: plumas rojas que caen girando y estelas de velocidad.
      L(4, 'Hawks', '#e0413a', '#ffb067', ['feathers', 'streaks'], 'hover', 'glow', false, f(1.4, 15)),
      // El héroe n.º 1 en llamas: lenguas de fuego, brasas y humo.
      L(5, 'Endeavor', '#ff7a1a', '#ffd166', ['flames', 'embers', 'smoke'], 'heavy', 'fire', false, f(1.4, 15)),
      // Llamas azules que también le queman a él: fuego azul y brasas que se apagan en gris.
      L(6, 'Dabi', '#4fb3ff', '#1d2b6b', ['flames', 'embers', 'decay'], 'menace', 'fire', false, f(1.4, 15)),
      // Explosiones en el contorno, humo y chispas.
      L(7, 'Bakugo — Máximo potencial', '#ff8a3d', '#ffd166', ['explosions', 'sparks', 'smoke'], 'agile', 'fire', false, f(1.4, 15)),
      // Fuerza pura: pisotones, ondas de choque y polvo.
      L(8, 'All Might — Prime', '#ffd166', '#3c7dff', ['stomp', 'pulse', 'streaks'], 'heavy', 'divine', false, f(1.4, 15)),
      // Desintegración: fragmentos que se deshacen y grietas por el suelo.
      L(9, 'Shigaraki — Forma final', '#c7c9cf', '#3a2a4a', ['decay', 'cracks', 'shadow'], 'menace', 'dark', false, f(1.4, 15)),
      // El cierre: rayos verdes por la silueta, chispas, ondas y polvo de impacto.
      L(10, 'Deku — Máximo potencial', '#5ee0a8', '#c6f36b', ['lightning', 'sparks', 'pulse', 'dust'], 'agile', 'electric', false, f(1.4, 15))
    ]
  }
];

export function getRoute(id: RouteId): RouteConfig {
  return ROUTES.find((r) => r.id === id) ?? ROUTES[0];
}

export function routeByNumber(n: number): RouteConfig | undefined {
  return ROUTES.find((r) => r.number === n);
}

export const imageKey = (route: RouteId, level: number) => `${route}-${level}`;

/** Nivel de espectacularidad (1–4) según el nivel del personaje. */
export function tierFor(level: number): 1 | 2 | 3 | 4 {
  if (level >= 10) return 4;
  if (level >= 7) return 3;
  if (level >= 4) return 2;
  return 1;
}
