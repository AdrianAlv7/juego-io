// Aplica estilos globales de la app (canvas full-screen y reset de margenes).
import "./style.css";
import "./ui/lobby.css";
// Importa el motor Phaser.
import Phaser from "phaser";
// Importa la configuracion centralizada del juego.
import gameConfig from "./config/gameConfig.js";
import { isFakeDepthPreviewEnabled } from "./config/runtimeSceneSelection.js";
import appAudioManager from "./ui/AppAudioManager.js";

const appRoot = document.getElementById("app");
if (appRoot) {
  appAudioManager.initialize(appRoot);
  if (!isFakeDepthPreviewEnabled()) {
    appAudioManager.enterLobby({ restartIntro: true });
  }
}

// Crea e inicia la instancia principal del juego.
new Phaser.Game(gameConfig);
