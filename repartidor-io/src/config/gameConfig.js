import Phaser from "phaser";
import GameScene from "../scenes/GameScene.js";

// Si lo pones en true, fuerza un loop de render a 60 FPS.
// En false, usa Hz altos del monitor (recomendado porque la simulacion ya es fija).
const LOCK_TO_60_FPS = true;
// Toma el ancho de la ventana actual para iniciar en full-screen responsivo.
const initialWidth =
  typeof window === "undefined" ? 1280 : window.innerWidth;
// Toma el alto de la ventana actual para iniciar en full-screen responsivo.
const initialHeight =
  typeof window === "undefined" ? 720 : window.innerHeight;
// Ajusta resolucion para pantallas HiDPI sin disparar demasiado el costo de GPU.
const renderResolution =
  typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

const gameConfig = {
  // Deja que Phaser elija WebGL o Canvas automaticamente.
  type: Phaser.AUTO,
  // Inserta el canvas dentro del div con id "app".
  parent: "app",
  // Resolucion inicial de render.
  width: initialWidth,
  height: initialHeight,
  // Color de fondo base si no hay elementos debajo.
  backgroundColor: "#14181d",
  // Suaviza bordes en sprites/escalados.
  antialias: true,
  // No usa modo pixel-art duro.
  pixelArt: false,
  // No redondea posiciones para permitir sub-pixel suave.
  roundPixels: false,
  // Resolucion de render efectiva (mejora nitidez en monitores densos).
  resolution: renderResolution,
  // Configuracion del loop de render.
  fps: LOCK_TO_60_FPS
    ? {
        // Objetivo de fps cuando se bloquea a 60.
        target: 60,
        // Mantiene RAF para evitar micro-jitter que setTimeout puede introducir.
        forceSetTimeOut: false,
      }
    : {
        // Permite Hz altos (120/144/165/240) si la maquina lo soporta.
        target: 240,
        // Piso minimo de referencia para manejo interno del loop.
        min: 30,
        // Mantiene RAF para menor latencia en monitores high-refresh.
        forceSetTimeOut: false,
        // Reduce smoothing historico del delta para menor variacion percibida.
        deltaHistory: 1,
      },
  // Configuracion de fisicas Arcade.
  physics: {
    default: "arcade",
    arcade: {
      // Activa colisiones y cuerpos de fisica en 2D.
      debug: false,
      // Sin gravedad vertical para vista top-down.
      gravity: { y: 0 },
    },
  },
  // Hace que el canvas use todo el viewport disponible.
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Escena principal del juego.
  scene: [GameScene],
};

export default gameConfig;
