// Aplica estilos globales de la app (canvas full-screen y reset de margenes).
import "./style.css";
// Importa el motor Phaser.
import Phaser from "phaser";
// Importa la configuracion centralizada del juego.
import gameConfig from "./config/gameConfig.js";

// Crea e inicia la instancia principal del juego.
new Phaser.Game(gameConfig);
