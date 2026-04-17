// Ciclo de vida base del GameScene.
// Se encarga de preload/create, registro de input, resize, shutdown y reseteo general de la escena.
import Phaser from "phaser";
import {
  GARAGE_MOTOS,
  getSelectedGarageMotoConfig,
  hasSavedGarageMotoSelection,
  loadSelectedGarageMotoId,
} from "../../garage/catalog.js";
import EmpPulseVisual from "../../items/EmpPulseVisual.js";
import PositiveStockSystem from "../../items/PositiveStockSystem.js";
import RouteRewardSystem from "../../items/RouteRewardSystem.js";
import ShieldEffectSystem from "../../items/ShieldEffectSystem.js";
import { createInventoryState } from "../../items/catalog.js";
import {
  createEmptyWeatherEventState as createEmptyWeatherEventStateFactory,
} from "../../events/weather/catalog.js";
import { preloadActiveMapAssets } from "../../world/activeMap.js";
import InputSystem from "../../systems/InputSystem.js";
import MultiplayerSystem from "../../network/MultiplayerSystem.js";
import appAudioManager from "../../ui/AppAudioManager.js";
import CollisionDebugOverlay from "../../debug/CollisionDebugOverlay.js";
import CollisionBuildingFakeDepthTest from "../../debug/CollisionBuildingFakeDepthTest.js";
import {
  RESUME_STABILIZE_FRAMES,
  STARTUP_STABILIZE_FRAMES,
  USERNAME_MAX_LENGTH,
} from "./constants.js";

const PLAYER_NAME_STORAGE_KEY = "deliver_player_name";
const LEGACY_PLAYER_NAME_STORAGE_KEY = "repartidor_player_name";

function registerInputKeys(scene) {
  scene.inputSystem = new InputSystem(scene);
  scene.controlPresetId = scene.inputSystem.getControlPresetId?.() || "flechitas";
  scene.restartLevelKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.R
  );
  scene.rainEventKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.ONE
  );
  scene.sunnyEventKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.TWO
  );
  scene.nightEventKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.THREE
  );
  scene.earthquakeEventKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.Q
  );
  scene.clearWeatherEventKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.FOUR
  );
  scene.trainEventKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.FIVE
  );
  scene.grantOilKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SIX
  );
  scene.grantWallKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SEVEN
  );
  scene.grantOilNumpadKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.NUMPAD_SIX
  );
  scene.grantWallNumpadKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.NUMPAD_SEVEN
  );
  scene.grantEmpKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.EIGHT
  );
  scene.grantEmpNumpadKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.NUMPAD_EIGHT
  );
  scene.grantShieldKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.NINE
  );
  scene.grantShieldNumpadKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.NUMPAD_NINE
  );
  scene.grantGhostKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.ZERO
  );
  scene.grantGhostNumpadKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO
  );
  scene.dropItemKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.Z
  );
  scene.turboKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  scene.settingsMenuKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.ESC
  );
  scene.collisionDebugOverlayKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.F10
  );
  scene.fakeDepthBuildingsToggleKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.P
  );
}

function buildRouteRewardSystem(scene) {
  return new RouteRewardSystem({
    onGrantItem: (rewardKey) =>
      scene.multiplayer?.emitClaimRouteReward?.(rewardKey),
    onGrantTurbo: () => {
      if (!scene.positiveStockSystem?.grantExtraTurbo()) return;
      scene.refreshPositiveStockUi();
      if (!scene.usingGameplayHudKit) {
        scene.statusBanner.setText("R2: turbo extra recibido");
        scene.statusBanner.setColor("#ffd27d");
        scene.statusBanner.setVisible(true);
      }
    },
  });
}

function buildMultiplayerCallbacks(scene) {
  return {
    onInit: () => scene.onSocketInit(),
    onLobbyState: (payload) => scene.onLobbyState(payload),
    onGameStarted: (payload) => scene.onGameStarted(payload),
    onFinishWindowStarted: (payload) => scene.onFinishWindowStarted(payload),
    onMatchFinished: (payload) => scene.onMatchFinished(payload),
    onRoomError: (payload) => scene.onRoomError(payload),
    onConnectError: (error) => scene.onConnectError(error),
    onLobbyRestarted: () => scene.onLobbyRestarted(),
    onRoomPlayerLeft: (payload) => scene.onRoomPlayerLeft(payload),
    onWeatherEventQueued: (payload) => scene.onWeatherEventQueued(payload),
    onWeatherEventStarted: (payload) => scene.onWeatherEventStarted(payload),
    onWeatherEventEnded: (payload) => scene.onWeatherEventEnded(payload),
    onTrainEventStarted: (payload) => scene.onTrainEventStarted(payload),
    onTrainEventEnded: (payload) => scene.onTrainEventEnded(payload),
    onTrackItemsSnapshot: (payload) => scene.onTrackItemsSnapshot(payload),
    onTrackItemAdded: (payload) => scene.onTrackItemAdded(payload),
    onTrackItemUpdated: (payload) => scene.onTrackItemUpdated(payload),
    onTrackItemRemoved: (payload) => scene.onTrackItemRemoved(payload),
    onInventoryState: (payload) => scene.onInventoryState(payload),
    onEmpPulseStarted: (payload) => scene.onEmpPulseStarted(payload),
    onInventoryItemActivated: (payload) =>
      scene.onInventoryItemActivated(payload),
  };
}

function registerShutdown(scene) {
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off("resize", scene.handleResize, scene);
    document.removeEventListener("visibilitychange", scene.onVisibilityChange);
    scene.hud?.destroy();
    scene.hud = null;
    if (scene.effectCamera) {
      scene.cameras.remove(scene.effectCamera);
      scene.effectCamera = null;
    }
    if (scene.hudCamera) {
      scene.cameras.remove(scene.hudCamera);
      scene.hudCamera = null;
    }
    scene.multiplayer?.destroy();
    scene.collisionDebugOverlay?.destroy?.();
    scene.collisionDebugOverlay = null;
    scene.collisionBuildingFakeDepthTest?.destroy?.();
    scene.collisionBuildingFakeDepthTest = null;
    scene.destroyGarageUi?.();
    scene.destroySettingsUi?.();
    scene.destroyNameEntryUi();
    scene.destroyLeaveRoomUi();
    scene.destroyRoomShareUi();
    scene.destroyLobbyUi?.();
    scene.destroyDebugFinishUi();
    scene.destroyLobbyReturnUi();
    scene.destroyWeatherUi();
    scene.destroyPositiveStockUi();
    scene.destroyItemUi();
    scene.empPulseVisual?.destroy();
    scene.empPulseVisual = null;
  });
}

export const gameSceneLifecycleMethods = {
  init(data = {}) {
    this.autoReconnectLobby = Boolean(data.autoReconnect);
  },

  preload() {
    this.load.image("moto", "assets/moto.png");
    GARAGE_MOTOS.forEach((motoConfig) => {
      if (motoConfig.textureKey === "moto") return;
      this.load.image(motoConfig.textureKey, motoConfig.assetPath);
    });
    this.load.image("weather-raindrop", "assets/gota.png");
    // Textura de prueba para fachadas del fake depth.
    this.load.image("debug-wall-side", "assets/pared.png");
    // Textura de prueba para el techo del fake depth.
    this.load.image("debug-roof-top", "assets/techo.jpg");
    preloadActiveMapAssets(this);
  },

  create() {
    registerInputKeys(this);
    this.collisionDebugOverlay = new CollisionDebugOverlay(this, {
      enabled: false,
      toggleKey: this.collisionDebugOverlayKey,
    });
    this.collisionBuildingFakeDepthTest = new CollisionBuildingFakeDepthTest(this, {
      enabled: false,
      toggleKey: this.fakeDepthBuildingsToggleKey,
    });
    this.selectedGarageMotoId = loadSelectedGarageMotoId();
    this.garageSelectionWasManual = hasSavedGarageMotoSelection();
    this.selectedGarageMotoTextureKey =
      getSelectedGarageMotoConfig(this.selectedGarageMotoId).textureKey;

    this.createLobbyUi();
    this.createStatusBanner();
    this.createWeatherUi();
    this.createPositiveStockUi();
    this.createItemUi();
    this.createDebugFinishUi();
    this.createLobbyReturnUi();
    this.createLeaveRoomUi();
    this.createRoomShareUi();
    this.createSettingsUi?.();
    this.createNameEntryUi();
    this.createGarageUi?.();
    this.empPulseVisual = new EmpPulseVisual(this, { depth: 26 });
    this.positiveStockSystem = new PositiveStockSystem();
    this.shieldEffectSystem = new ShieldEffectSystem();
    this.routeRewardSystem = buildRouteRewardSystem(this);

    this.multiplayer = new MultiplayerSystem(this, {
      spriteKey: "moto",
      getLocalProgress: () => this.map?.getRaceProgress?.(this.moto) || null,
      getLocalHudSnapshot: () => this.latestLocalHudSnapshot || null,
      callbacks: buildMultiplayerCallbacks(this),
    });

    const cachedName =
      window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_PLAYER_NAME_STORAGE_KEY);
    if (cachedName && this.nameInput) {
      this.nameInput.value = cachedName.slice(0, USERNAME_MAX_LENGTH);
    }
    if (this.autoReconnectLobby && cachedName && !this.isRegistered) {
      this.submitNameEntry();
    }

    this.scale.on("resize", this.handleResize, this);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.game.loop.resetDelta?.();
    this.syncKeyboardCaptureState();
    registerShutdown(this);
  },

  createEmptyWeatherEventState() {
    return createEmptyWeatherEventStateFactory();
  },

  handleResize(gameSize) {
    if (this.lobbyBackdrop) {
      this.lobbyBackdrop.setPosition(gameSize.width / 2, gameSize.height / 2);
      this.lobbyBackdrop.setSize(gameSize.width, gameSize.height);
      this.lobbyCard?.setPosition(gameSize.width / 2, gameSize.height / 2);
      this.lobbyCard?.setSize(
        Math.min(980, gameSize.width - 80),
        Math.min(760, gameSize.height - 100)
      );
      this.lobbyPlayersPanel?.setPosition(gameSize.width / 2, gameSize.height / 2 - 18);
      this.lobbyPlayersPanel?.setSize(
        Math.min(860, gameSize.width - 140),
        240
      );
      this.lobbyTitle.setPosition(gameSize.width / 2, 142);
      this.lobbySubtitle.setPosition(gameSize.width / 2, 204);
      this.playersListText.setPosition(gameSize.width / 2, gameSize.height / 2 - 116);
      this.playersListText.setWordWrapWidth(Math.min(760, gameSize.width - 200));
      this.lobbyMessage.setPosition(gameSize.width / 2, gameSize.height - 174);
      this.lobbyMessage.setWordWrapWidth(Math.min(820, gameSize.width - 140));
      this.startButtonRect.setPosition(gameSize.width / 2, gameSize.height - 104);
      this.startButtonLabel.setPosition(gameSize.width / 2, gameSize.height - 104);
    }

    if (this.statusBanner) {
      this.statusBanner.setPosition(gameSize.width / 2, 60);
    }

    this.layoutWeatherUi(gameSize);
    if (this.effectCamera) {
      this.effectCamera.setViewport(0, 0, gameSize.width, gameSize.height);
    }

    if (this.matchRunning && this.moto) {
      const cam = this.cameras.main;
      cam.setViewport(0, 0, gameSize.width, gameSize.height);
      cam.setDeadzone(
        Math.max(140, gameSize.width * 0.16),
        Math.max(100, gameSize.height * 0.14)
      );
      if (this.hudCamera) {
        this.hudCamera.setViewport(0, 0, gameSize.width, gameSize.height);
      }
    }
  },

  resetToLobby() {
    this.collisionDebugOverlay?.clearMap?.();
    this.collisionBuildingFakeDepthTest?.clearMap?.();
    this.map?.destroy?.();
    if (this.moto) {
      this.moto.sprite.destroy();
      this.moto = null;
    }
    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }
    this.usingGameplayHudKit = false;
    if (this.hudCamera) {
      this.cameras.remove(this.hudCamera);
      this.hudCamera = null;
    }
    if (this.effectCamera) {
      this.cameras.remove(this.effectCamera);
      this.effectCamera = null;
    }

    this.map = null;
    if (this.playersGroup) {
      this.playersGroup.clear(true, true);
      this.playersGroup = null;
    }
    this.matchRunning = false;
    this.matchEnded = false;
    this.finishSent = false;
    this.finishWindowEndsAtMs = 0;
    this.latestLocalHudSnapshot = null;
    this.spectatorModeActive = false;
    this.spectatorPendingStartAtMs = 0;
    this.spectatorTargetId = "";
    this.spectatorCameraTargetId = "";
    this.spectatorTargetFinished = false;
    this.spectatorDebugOverride = false;
    this.lobbyReturnAtMs = 0;
    this.matchResultText = "";
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.cameraEngineVibrationOffsetX = 0;
    this.cameraEngineVibrationOffsetY = 0;
    this.earthquakeFadeStartedAtMs = 0;
    this.earthquakeFadeUntilMs = 0;
    this.hudFilterAccumulatorMs = 0;
    this.simulationAccumulatorMs = 0;
    this.noCatchUpFrames = STARTUP_STABILIZE_FRAMES;
    this.clearLocalWeatherEventState();
    this.setWeatherControlsVisible(false);
    this.itemInventoryState = createInventoryState([]);
    this.refreshItemUi();
    this.setItemUiVisible(false);
    this.positiveStockSystem?.resetForMatch();
    this.shieldEffectSystem?.reset();
    this.routeRewardSystem?.reset();
    this.refreshPositiveStockUi();
    this.setPositiveStockUiVisible(false);
    this.setDebugFinishUiVisible(false);
    this.setLobbyReturnUiVisible(false);
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = false;
    this.applyEmpHudSuppression(false);

    this.multiplayer?.attachGroup(null);
    this.setLobbyVisible(true);
    this.setLeaveRoomUiVisible(this.isRegistered && !this.matchRunning);
    this.updateRoomShareUi();
    this.statusBanner.setVisible(false);
    this.syncKeyboardCaptureState();
    this.renderLobbyState();
    appAudioManager.stopGameMoto({ fadeOutMs: 120 });
    appAudioManager.enterLobby({ restartIntro: true });
  },

  setLobbyVisible(visible) {
    this.lobbyBackdrop.setVisible(visible);
    this.lobbyCard?.setVisible(visible);
    this.lobbyPlayersPanel?.setVisible(visible);
    this.lobbyTitle.setVisible(visible);
    this.lobbySubtitle.setVisible(visible);
    this.playersListText.setVisible(visible);
    this.lobbyMessage.setVisible(visible);
    if (visible) {
      if (!this.isRegistered && this.nameEntryRoot) {
        this.nameEntryRoot.style.display = "flex";
      }
      this.renderLobbyState();
    } else {
      this.blurNameEntry();
      this.readyButtonRect?.setVisible(false);
      this.readyButtonLabel?.setVisible(false);
      this.startButtonRect.setVisible(false);
      this.startButtonLabel.setVisible(false);
      if (this.nameEntryRoot) {
        this.nameEntryRoot.style.display = "none";
      }
    }
    this.setLeaveRoomUiVisible(visible && this.isRegistered && !this.matchRunning);
    this.updateRoomShareUi();
    this.syncKeyboardCaptureState();
  },

  onVisibilityChange() {
    this.simulationAccumulatorMs = 0;
    this.game.loop.resetDelta?.();
    if (!document.hidden) {
      this.noCatchUpFrames = RESUME_STABILIZE_FRAMES;
    }
  },

  runSimulationStep(stepMs) {
    if (!this.moto || !this.map) return;

    this.shieldEffectSystem?.update?.(this.time.now);
    const shieldState = this.shieldEffectSystem?.getState?.(this.time.now) || {};
    this.moto.setShieldVisualActive?.(Boolean(shieldState.active), {
      remainingMs: Number(shieldState.remainingMs || 0),
    });
    const settingsOpen = Boolean(this.hud?.isSettingsMenuOpen?.());
    const spectatorInputLocked =
      this.spectatorModeActive || this.spectatorPendingStartAtMs > 0;
    const playerLocked =
      settingsOpen ||
      spectatorInputLocked ||
      this.matchEnded ||
      (this.map.isPlayerLocked?.() ?? false) ||
      (this.map.isRiderRepairing?.() ?? false);
    if (playerLocked) {
      this.moto.haltMotion();
    } else {
      this.moto.update(stepMs);
    }
    this.map.enforcePlayer(this.moto, stepMs);
    const postCollisionShieldState =
      this.shieldEffectSystem?.getState?.(this.time.now) || {};
    this.moto.setShieldVisualActive?.(Boolean(postCollisionShieldState.active), {
      remainingMs: Number(postCollisionShieldState.remainingMs || 0),
    });
  },

  isLocalHost() {
    return this.currentLobbyState?.hostId === this.multiplayer?.selfId;
  },
};
