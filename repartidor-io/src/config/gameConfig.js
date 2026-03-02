import Phaser from "phaser";
import GameScene from "../scenes/GameScene.js";

// Si lo pones en true, fuerza un loop de render a 60 FPS.
// En false, usa Hz altos del monitor (recomendado porque la simulacion ya es fija).
const LOCK_TO_60_FPS = true;
// Resolucion logica fija para que todos vean el mismo campo de juego.
const FIXED_GAME_WIDTH = 1920;
const FIXED_GAME_HEIGHT = 1080;
// Ajusta resolucion para pantallas HiDPI sin disparar demasiado el costo de GPU.
const renderResolution =
  typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

const gameConfig = {
  // Deja que Phaser elija WebGL o Canvas automaticamente.
  type: Phaser.AUTO,
  // Inserta el canvas dentro del div con id "app".
  parent: "app",
  // Resolucion logica fija.
  width: FIXED_GAME_WIDTH,
  height: FIXED_GAME_HEIGHT,
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
  // Escala al tamano real del viewport para evitar barras laterales (letterbox)
  // y permitir que el HUD llegue a las orillas visibles de la pantalla.
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  // Escena principal del juego.
  scene: [GameScene],
};

export default gameConfig;
