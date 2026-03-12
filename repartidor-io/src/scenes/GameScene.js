// Orquestador principal de la escena.
// Solo inicializa estado base y compone los modulos especializados de GameScene.
import Phaser from "phaser";
import { gameSceneGameplayMethods } from "./gameScene/gameplayMethods.js";
import { initializeGameSceneState } from "./gameScene/initializeState.js";
import { gameSceneLifecycleMethods } from "./gameScene/lifecycleMethods.js";
import { gameSceneMatchMethods } from "./gameScene/matchMethods.js";
import { gameSceneUiMethods } from "./gameScene/uiMethods.js";

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    initializeGameSceneState(this);
  }
}

Object.assign(
  GameScene.prototype,
  gameSceneLifecycleMethods,
  gameSceneUiMethods,
  gameSceneMatchMethods,
  gameSceneGameplayMethods
);

export default GameScene;
