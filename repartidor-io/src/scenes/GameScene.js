import Phaser from "phaser";
import Moto from "../entities/moto.js";
import NightVisionOverlay from "../events/weather/NightVisionOverlay.js";
import EmpPulseVisual from "../items/EmpPulseVisual.js";
import ItemInventoryPanel from "../items/ItemInventoryPanel.js";
import PositiveStockPanel from "../items/PositiveStockPanel.js";
import PositiveStockSystem from "../items/PositiveStockSystem.js";
import RouteRewardSystem from "../items/RouteRewardSystem.js";
import ShieldEffectSystem from "../items/ShieldEffectSystem.js";
import { ITEM_CONFIG, ITEM_TYPES, createInventoryState } from "../items/catalog.js";
import {
  WEATHER_EVENT_CONFIG,
  WEATHER_EVENT_TYPES,
  createEmptyWeatherEventState,
} from "../events/weather/catalog.js";
import { ACTIVE_MAP, preloadActiveMapAssets } from "../world/activeMap.js";
import InputSystem from "../systems/InputSystem.js";
import DebugHUD from "../ui/DebugHUD.js";
import MultiplayerSystem from "../network/MultiplayerSystem.js";
import { speedPxPerSecToKmh } from "../world/race/utils/telemetry.js";

const DEFAULT_WORLD_WIDTH = 6000;
const DEFAULT_WORLD_HEIGHT = 6000;
const DESIGN_VIEWPORT_WIDTH = 1920;
const DESIGN_VIEWPORT_HEIGHT = 1080;

const SIMULATION_FPS = 60;
const FIXED_STEP_MS = 1000 / SIMULATION_FPS;
const MAX_CATCH_UP_STEPS = 5;
const MAX_ACCUMULATED_DELTA_MS = 250;
const CAMERA_DELTA_CAP_MS = 50;
const DELTA_SPIKE_RESET_MS = 90;
const RESUME_STABILIZE_FRAMES = 6;
const STARTUP_STABILIZE_FRAMES = 8;

// ================= CAMARA: DISTANCIA / FOV =================
// Menor zoom = camara mas alejada.
// Ajusta estos valores para encontrar el punto optimo.
const CAMERA_ZOOM_SETTINGS = {
  baseZoom: 0.5,
  fastZoom: 0.4,
  // 1 = mantiene FOV estable contra cambios de viewport/browser zoom.
  // Baja a 0.8 o 0.6 si quieres menos compensacion.
  viewportCompensation: 1,
  // Zoom del HUD para darle vida sin jalarlo demasiado al centro.
  // Mantenerlo cerca de 1 reduce desplazamiento visual en las orillas.
  hudBaseZoom: 1,
  hudFastZoom: 0.95,
  hudDamping: 12,
};
const CAMERA_LOOK_AHEAD_MAX = 110;
const ZOOM_DAMPING = 8;
const OFFSET_DAMPING = 10;
const HIGH_SPEED_CAMERA_FEEL = {
  triggerKmh: 205,
  blendRangeKmh: 24,
  maxExtraZoomOut: 0.012,
  zoomPulseAmplitude: 0.0032,
  offsetWaveAmplitudePx: 2,
  offsetWaveFreqX: 0.012,
  offsetWaveFreqY: 0.016,
};
const TOP_SPEED_SCREEN_FX = {
  // SPEED FX THRESHOLD:
  // change this to test at lower speed (for example 80 or 120).
  triggerKmh: 205,
  blendRangeKmh: 42,
  baseIntensityAtTrigger: 0.58,
  // Stronger camera punch for readability.
  extraZoomOut: 0.05,
  zoomPulseAmplitude: 0.0038,
  // Controlled shake: mostly left-right, smooth but stronger.
  shakeAmplitudePx: 18,
  shakeFreqX: 0.012,
  shakeFreqXSecondary: 0.019,
  shakeSecondaryWeight: 0.32,
  shakeFreqY: 0.028,
  verticalDriftPx: 0.45,
};
const USERNAME_MAX_LENGTH = 16;
const HUD_FILTER_REFRESH_MS = 250;
const WEATHER_OVERLAY_DAMPING = 7;
const WEATHER_UI_MARGIN = 18;

function damp(current, target, dampingPerSecond, deltaMs) {
  const t = 1 - Math.exp((-dampingPerSecond * deltaMs) / 1000);
  return Phaser.Math.Linear(current, target, t);
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    this.map = null;
    this.moto = null;
    this.hud = null;
    this.effectCamera = null;
    this.hudCamera = null;
    this.playersGroup = null;
    this.multiplayer = null;

    this.matchRunning = false;
    this.matchEnded = false;
    this.finishSent = false;
    this.currentLobbyState = null;
    this.isRegistered = false;

    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.hudFilterAccumulatorMs = 0;
    this.simulationAccumulatorMs = 0;
    this.noCatchUpFrames = STARTUP_STABILIZE_FRAMES;
    this.weatherEvent = this.createEmptyWeatherEventState();
    this.weatherOverlayAlpha = 0;

    this.nameEntryRoot = null;
    this.nameInput = null;
    this.nameSubmitButton = null;
    this.weatherOverlay = null;
    this.weatherEventText = null;
    this.weatherHintText = null;
    this.weatherButtons = [];
    this.nightVisionOverlay = null;
    this.itemPanel = null;
    this.stockPanel = null;
    this.empPulseVisual = null;
    this.itemInventoryState = createInventoryState([]);
    this.positiveStockSystem = null;
    this.shieldEffectSystem = null;
    this.routeRewardSystem = null;
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = false;
    this.rainEventKey = null;
    this.sunnyEventKey = null;
    this.nightEventKey = null;
    this.clearWeatherEventKey = null;
    this.trainEventKey = null;
    this.dropItemKey = null;
    this.grantOilKey = null;
    this.grantWallKey = null;
    this.grantOilNumpadKey = null;
    this.grantWallNumpadKey = null;
    this.grantEmpKey = null;
    this.grantEmpNumpadKey = null;
    this.turboKey = null;

    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.matchResultText = "";
    this.finishWindowEndsAtMs = 0;
  }

  preload() {
    this.load.image("moto", "assets/moto.png");
    preloadActiveMapAssets(this);
  }

  create() {
    this.inputSystem = new InputSystem(this);
    this.restartLevelKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R
    );
    this.rainEventKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ONE
    );
    this.sunnyEventKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.TWO
    );
    this.nightEventKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.THREE
    );
    this.clearWeatherEventKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.FOUR
    );
    this.trainEventKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.FIVE
    );
    this.grantOilKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SIX
    );
    this.grantWallKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SEVEN
    );
    this.grantOilNumpadKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_SIX
    );
    this.grantWallNumpadKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_SEVEN
    );
    this.grantEmpKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.EIGHT
    );
    this.grantEmpNumpadKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_EIGHT
    );
    this.dropItemKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.Z
    );
    this.turboKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    this.createLobbyUi();
    this.createStatusBanner();
    this.createWeatherUi();
    this.createPositiveStockUi();
    this.createItemUi();
    this.createNameEntryUi();
    this.empPulseVisual = new EmpPulseVisual(this, { depth: 26 });
    this.positiveStockSystem = new PositiveStockSystem();
    this.shieldEffectSystem = new ShieldEffectSystem();
    this.routeRewardSystem = new RouteRewardSystem({
      onGrantItem: (rewardKey) => this.multiplayer?.emitClaimRouteReward?.(rewardKey),
      onGrantTurbo: () => {
        if (!this.positiveStockSystem?.grantExtraTurbo()) return;
        this.refreshPositiveStockUi();
        this.statusBanner.setText("R2: turbo extra recibido");
        this.statusBanner.setColor("#ffd27d");
        this.statusBanner.setVisible(true);
      },
    });

    this.multiplayer = new MultiplayerSystem(this, {
      spriteKey: "moto",
      callbacks: {
        onInit: () => this.onSocketInit(),
        onLobbyState: (payload) => this.onLobbyState(payload),
        onGameStarted: (payload) => this.onGameStarted(payload),
        onFinishWindowStarted: (payload) => this.onFinishWindowStarted(payload),
        onMatchFinished: (payload) => this.onMatchFinished(payload),
        onRoomError: (payload) => this.onRoomError(payload),
        onConnectError: (error) => this.onConnectError(error),
        onLobbyRestarted: () => this.onLobbyRestarted(),
        onWeatherEventQueued: (payload) => this.onWeatherEventQueued(payload),
        onWeatherEventStarted: (payload) => this.onWeatherEventStarted(payload),
        onWeatherEventEnded: (payload) => this.onWeatherEventEnded(payload),
        onTrainEventStarted: (payload) => this.onTrainEventStarted(payload),
        onTrainEventEnded: (payload) => this.onTrainEventEnded(payload),
        onTrackItemsSnapshot: (payload) => this.onTrackItemsSnapshot(payload),
        onTrackItemAdded: (payload) => this.onTrackItemAdded(payload),
        onTrackItemUpdated: (payload) => this.onTrackItemUpdated(payload),
        onTrackItemRemoved: (payload) => this.onTrackItemRemoved(payload),
        onInventoryState: (payload) => this.onInventoryState(payload),
        onEmpPulseStarted: (payload) => this.onEmpPulseStarted(payload),
        onInventoryItemActivated: (payload) => this.onInventoryItemActivated(payload),
      },
    });

    const cachedName = window.localStorage.getItem("repartidor_player_name");
    if (cachedName && this.nameInput) {
      this.nameInput.value = cachedName.slice(0, USERNAME_MAX_LENGTH);
    }

    this.scale.on("resize", this.handleResize, this);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.game.loop.resetDelta?.();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.handleResize, this);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      this.hud?.destroy();
      this.hud = null;
      if (this.effectCamera) {
        this.cameras.remove(this.effectCamera);
        this.effectCamera = null;
      }
      if (this.hudCamera) {
        this.cameras.remove(this.hudCamera);
        this.hudCamera = null;
      }
      this.multiplayer?.destroy();
      this.destroyNameEntryUi();
      this.destroyWeatherUi();
      this.destroyPositiveStockUi();
      this.destroyItemUi();
      this.empPulseVisual?.destroy();
      this.empPulseVisual = null;
    });
  }

  createEmptyWeatherEventState() {
    return createEmptyWeatherEventState();
  }

  createNameEntryUi() {
    const appRoot = document.getElementById("app");
    if (!appRoot) return;

    appRoot.style.position = "relative";

    this.nameEntryRoot = document.createElement("div");
    this.nameEntryRoot.style.position = "absolute";
    this.nameEntryRoot.style.left = "50%";
    this.nameEntryRoot.style.top = "74%";
    this.nameEntryRoot.style.transform = "translate(-50%, -50%)";
    this.nameEntryRoot.style.display = "flex";
    this.nameEntryRoot.style.gap = "10px";
    this.nameEntryRoot.style.zIndex = "3000";

    this.nameInput = document.createElement("input");
    this.nameInput.type = "text";
    this.nameInput.maxLength = USERNAME_MAX_LENGTH;
    this.nameInput.placeholder = "Username corto";
    this.nameInput.style.width = "260px";
    this.nameInput.style.height = "44px";
    this.nameInput.style.padding = "0 12px";
    this.nameInput.style.border = "2px solid #90c5a6";
    this.nameInput.style.borderRadius = "8px";
    this.nameInput.style.background = "#10171f";
    this.nameInput.style.color = "#eef4fb";
    this.nameInput.style.fontFamily = "Consolas, monospace";
    this.nameInput.style.fontSize = "18px";

    this.nameSubmitButton = document.createElement("button");
    this.nameSubmitButton.textContent = "Entrar";
    this.nameSubmitButton.style.height = "44px";
    this.nameSubmitButton.style.padding = "0 16px";
    this.nameSubmitButton.style.border = "2px solid #90c5a6";
    this.nameSubmitButton.style.borderRadius = "8px";
    this.nameSubmitButton.style.background = "#1f5f46";
    this.nameSubmitButton.style.color = "#ffffff";
    this.nameSubmitButton.style.fontFamily = "Consolas, monospace";
    this.nameSubmitButton.style.fontSize = "18px";
    this.nameSubmitButton.style.cursor = "pointer";

    const submit = () => this.submitNameEntry();
    this.nameSubmitButton.addEventListener("click", submit);
    this.nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
    });

    this.nameEntryRoot.appendChild(this.nameInput);
    this.nameEntryRoot.appendChild(this.nameSubmitButton);
    appRoot.appendChild(this.nameEntryRoot);
    this.nameInput.focus();
  }

  submitNameEntry() {
    if (!this.multiplayer || this.isRegistered) return;
    const raw = this.nameInput?.value?.trim() || "";
    const safeName = (raw || "Jugador").slice(0, USERNAME_MAX_LENGTH);
    window.localStorage.setItem("repartidor_player_name", safeName);

    this.blurNameEntry();
    this.nameInput.value = safeName;
    this.nameInput.disabled = true;
    this.nameSubmitButton.disabled = true;
    this.nameSubmitButton.textContent = "Conectando...";
    this.lobbyMessage.setText("Conectando a sala...");
    this.lobbyMessage.setColor("#ffd27d");

    this.multiplayer.start({
      name: safeName,
      preferredSpawn: ACTIVE_MAP.getSpawnPoint(),
    });
  }

  onSocketInit() {
    this.isRegistered = true;
    this.blurNameEntry();
    if (this.nameEntryRoot) {
      this.nameEntryRoot.style.display = "none";
    }
    this.renderLobbyState();
  }

  blurNameEntry() {
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur?.();
    }
    this.nameInput?.blur?.();
    this.nameSubmitButton?.blur?.();
  }

  destroyNameEntryUi() {
    if (!this.nameEntryRoot) return;
    this.nameEntryRoot.remove();
    this.nameEntryRoot = null;
    this.nameInput = null;
    this.nameSubmitButton = null;
  }

  createLobbyUi() {
    const { width, height } = this.scale.gameSize;

    this.lobbyBackdrop = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x0f141a,
      0.9
    );
    this.lobbyBackdrop.setScrollFactor(0);
    this.lobbyBackdrop.setDepth(2000);

    this.lobbyTitle = this.add.text(width / 2, 120, "Sala Repartidor.io", {
      fontFamily: "Consolas, monospace",
      fontSize: "58px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    this.lobbyTitle.setOrigin(0.5);
    this.lobbyTitle.setScrollFactor(0);
    this.lobbyTitle.setDepth(2010);

    this.lobbySubtitle = this.add.text(width / 2, 185, "Esperando jugadores", {
      fontFamily: "Consolas, monospace",
      fontSize: "24px",
      color: "#b8c4d1",
    });
    this.lobbySubtitle.setOrigin(0.5);
    this.lobbySubtitle.setScrollFactor(0);
    this.lobbySubtitle.setDepth(2010);

    this.playersListText = this.add.text(width / 2, 270, "Conectando...", {
      fontFamily: "Consolas, monospace",
      fontSize: "24px",
      color: "#e8edf3",
      align: "left",
      lineSpacing: 8,
    });
    this.playersListText.setOrigin(0.5, 0);
    this.playersListText.setScrollFactor(0);
    this.playersListText.setDepth(2010);

    this.lobbyMessage = this.add.text(width / 2, height - 180, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "22px",
      color: "#ffd27d",
      align: "center",
    });
    this.lobbyMessage.setOrigin(0.5);
    this.lobbyMessage.setScrollFactor(0);
    this.lobbyMessage.setDepth(2010);

    this.startButtonRect = this.add.rectangle(
      width / 2,
      height - 95,
      320,
      74,
      0x2f7f5f,
      1
    );
    this.startButtonRect.setStrokeStyle(3, 0xa9ffd8, 0.9);
    this.startButtonRect.setInteractive({ useHandCursor: true });
    this.startButtonRect.setScrollFactor(0);
    this.startButtonRect.setDepth(2010);
    this.startButtonRect.on("pointerdown", () => {
      this.multiplayer?.emitStartGame(ACTIVE_MAP.getSpawnPoint());
    });

    this.startButtonLabel = this.add.text(width / 2, height - 95, "PLAY", {
      fontFamily: "Consolas, monospace",
      fontSize: "36px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    this.startButtonLabel.setOrigin(0.5);
    this.startButtonLabel.setScrollFactor(0);
    this.startButtonLabel.setDepth(2011);
  }

  createStatusBanner() {
    const { width } = this.scale.gameSize;
    this.statusBanner = this.add.text(width / 2, 60, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "34px",
      color: "#a7ffb8",
      fontStyle: "bold",
      stroke: "#102018",
      strokeThickness: 8,
    });
    this.statusBanner.setOrigin(0.5);
    this.statusBanner.setScrollFactor(0);
    this.statusBanner.setDepth(2100);
    this.statusBanner.setVisible(false);
    this.statusBanner.__isHudObject = true;
  }

  createWeatherUi() {
    const { width, height } = this.scale.gameSize;

    this.weatherOverlay = this.add.rectangle(
      0,
      0,
      width,
      height,
      0x6ea7ff,
      1
    );
    this.weatherOverlay.setOrigin(0);
    this.weatherOverlay.setScrollFactor(0);
    this.weatherOverlay.setDepth(2110);
    this.weatherOverlay.setAlpha(0);
    this.weatherOverlay.setVisible(false);
    this.nightVisionOverlay = new NightVisionOverlay(this, {
      depth: 2120,
      blockedRatio:
        WEATHER_EVENT_CONFIG[WEATHER_EVENT_TYPES.NIGHT].nightVision?.blockedRatio ?? 0.35,
      color: WEATHER_EVENT_CONFIG[WEATHER_EVENT_TYPES.NIGHT].nightVision?.color ?? 0x000000,
      alpha: WEATHER_EVENT_CONFIG[WEATHER_EVENT_TYPES.NIGHT].nightVision?.alpha ?? 1,
    });
    this.nightVisionOverlay.resize(this.scale.gameSize);

    this.weatherEventText = this.add.text(width / 2, 108, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#d7e1ef",
      stroke: "#111822",
      strokeThickness: 6,
    });
    this.weatherEventText.setOrigin(0.5);
    this.weatherEventText.setScrollFactor(0);
    this.weatherEventText.setDepth(2140);
    this.weatherEventText.setVisible(false);
    this.weatherEventText.__isHudObject = true;

    this.weatherHintText = this.add.text(0, 0, "Eventos: [1] lluvia  [2] asoleado  [3] noche  [4] limpiar  [5] tren", {
      fontFamily: "Consolas, monospace",
      fontSize: "18px",
      color: "#e7eef8",
    });
    this.weatherHintText.setScrollFactor(0);
    this.weatherHintText.setDepth(2140);
    this.weatherHintText.setVisible(false);
    this.weatherHintText.__isHudObject = true;

    const buttonConfigs = [
      {
        type: WEATHER_EVENT_TYPES.RAIN,
        label: "Lluvia",
        keyLabel: "[1]",
        fillColor: 0x2f5f90,
      },
      {
        type: WEATHER_EVENT_TYPES.SUNNY,
        label: "Asoleado",
        keyLabel: "[2]",
        fillColor: 0x995c24,
      },
      {
        type: WEATHER_EVENT_TYPES.NIGHT,
        label: "Noche",
        keyLabel: "[3]",
        fillColor: 0x283047,
      },
      {
        type: WEATHER_EVENT_TYPES.NONE,
        label: "Quitar",
        keyLabel: "[4]",
        fillColor: 0x39424d,
        action: "clear",
      },
      {
        type: "train",
        label: "Tren",
        keyLabel: "[5]",
        fillColor: 0x6a2d2d,
        action: "train",
      },
    ];

    this.weatherButtons = buttonConfigs.map((config) => {
      const background = this.add.rectangle(0, 0, 156, 38, config.fillColor, 0.92);
      background.setOrigin(0, 0);
      background.setScrollFactor(0);
      background.setDepth(2140);
      background.setStrokeStyle(2, 0xffffff, 0.18);
      background.setVisible(false);
      background.setInteractive({ useHandCursor: true });
      background.on("pointerdown", () => {
        if (config.action === "clear" || config.type === WEATHER_EVENT_TYPES.NONE) {
          this.multiplayer?.emitClearWeatherEvent();
        } else if (config.action === "train") {
          this.multiplayer?.emitStartTrainEvent();
        } else {
          this.multiplayer?.emitQueueWeatherEvent(config.type);
        }
      });
      background.__isHudObject = true;

      const label = this.add.text(0, 0, `${config.keyLabel} ${config.label}`, {
        fontFamily: "Consolas, monospace",
        fontSize: "18px",
        color: "#ffffff",
      });
      label.setOrigin(0.5);
      label.setScrollFactor(0);
      label.setDepth(2141);
      label.setVisible(false);
      label.__isHudObject = true;

      return {
        ...config,
        background,
        label,
      };
    });

    this.layoutWeatherUi(this.scale.gameSize);
    this.setWeatherControlsVisible(false);
  }

  layoutWeatherUi(gameSize) {
    if (this.weatherOverlay) {
      this.weatherOverlay.setSize(gameSize.width, gameSize.height);
    }
    this.nightVisionOverlay?.resize(gameSize);

    if (this.weatherEventText) {
      this.weatherEventText.setPosition(gameSize.width / 2, 108);
    }

    if (this.weatherHintText) {
      this.weatherHintText.setPosition(
        WEATHER_UI_MARGIN,
        gameSize.height - 128
      );
    }

    const startX = WEATHER_UI_MARGIN;
    const y = gameSize.height - 92;
    const gap = 12;
    let currentX = startX;

    this.weatherButtons.forEach((button) => {
      button.background.setPosition(currentX, y);
      button.label.setPosition(currentX + 78, y + 19);
      currentX += button.background.width + gap;
    });
  }

  setWeatherControlsVisible(visible) {
    const showControls = visible && this.isLocalHost();
    this.weatherHintText?.setVisible(showControls);
    this.weatherButtons.forEach((button) => {
      button.background.setVisible(showControls);
      button.label.setVisible(showControls);
      if (showControls) {
        button.background.setInteractive({ useHandCursor: true });
      } else {
        button.background.disableInteractive();
      }
    });

    if (!visible) {
      this.weatherEventText?.setVisible(false);
    } else {
      this.refreshWeatherUi();
    }
  }

  refreshWeatherUi() {
    const hasWeatherState = this.weatherEvent.type !== WEATHER_EVENT_TYPES.NONE;

    this.weatherButtons.forEach((button) => {
      const selected =
        button.action !== "clear" &&
        button.action !== "train" &&
        button.type === this.weatherEvent.type;
      button.background.setAlpha(selected ? 1 : 0.88);
      button.background.setStrokeStyle(
        selected ? 3 : 2,
        selected ? 0xffffff : 0xffffff,
        selected ? 0.42 : 0.18
      );
      button.label.setAlpha(selected ? 1 : 0.9);
    });

    if (!this.weatherEventText) return;

    if (!hasWeatherState || !this.matchRunning) {
      this.weatherEventText.setVisible(false);
      return;
    }

    const now = Date.now();
    if (this.weatherEvent.phase === "countdown") {
      const remainingMs = Math.max(0, this.weatherEvent.startsAtMs - now);
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      this.weatherEventText.setText(
        `${this.weatherEvent.label} en ${remainingSeconds}`
      );
    } else {
      const remainingMs = Math.max(0, this.weatherEvent.endsAtMs - now);
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      this.weatherEventText.setText(
        `${this.weatherEvent.label} activa | ${remainingSeconds}s`
      );
    }
    this.weatherEventText.setColor(this.weatherEvent.accentColor);
    this.weatherEventText.setVisible(true);
  }

  destroyWeatherUi() {
    this.weatherOverlay?.destroy();
    this.weatherOverlay = null;
    this.nightVisionOverlay?.destroy();
    this.nightVisionOverlay = null;
    this.weatherEventText?.destroy();
    this.weatherEventText = null;
    this.weatherHintText?.destroy();
    this.weatherHintText = null;
    this.weatherButtons.forEach((button) => {
      button.background.destroy();
      button.label.destroy();
    });
    this.weatherButtons = [];
  }

  createPositiveStockUi() {
    this.stockPanel = new PositiveStockPanel(this, {
      depth: 2140,
      margin: WEATHER_UI_MARGIN,
    });
    this.stockPanel.setVisible(false);
  }

  destroyPositiveStockUi() {
    this.stockPanel?.destroy();
    this.stockPanel = null;
  }

  setPositiveStockUiVisible(visible) {
    this.stockPanel?.setVisible(Boolean(visible));
  }

  refreshPositiveStockUi() {
    this.stockPanel?.update(this.positiveStockSystem?.getHudState?.() || {});
  }

  createItemUi() {
    this.itemPanel = new ItemInventoryPanel(this, {
      depth: 2140,
      margin: WEATHER_UI_MARGIN,
      onGrantOil: () => {
        if (!this.matchRunning || !this.isLocalHost()) return;
        this.multiplayer?.emitGrantItem(ITEM_TYPES.OIL);
      },
      onGrantWall: () => {
        if (!this.matchRunning || !this.isLocalHost()) return;
        this.multiplayer?.emitGrantItem(ITEM_TYPES.WALL);
      },
      onGrantEmp: () => {
        if (!this.matchRunning || !this.isLocalHost()) return;
        this.multiplayer?.emitGrantItem(ITEM_TYPES.EMP);
      },
    });
    this.itemPanel.setInventory(this.itemInventoryState);
    this.itemPanel.setVisible(false);
  }

  destroyItemUi() {
    this.itemPanel?.destroy();
    this.itemPanel = null;
  }

  setItemUiVisible(visible) {
    this.itemPanel?.setVisible(Boolean(visible));
    this.itemPanel?.setHostControlsVisible(Boolean(visible) && this.isLocalHost());
  }

  refreshItemUi() {
    this.itemPanel?.setInventory(this.itemInventoryState);
    this.itemPanel?.setHostControlsVisible(this.matchRunning && this.isLocalHost());
  }

  handleResize(gameSize) {
    if (this.lobbyBackdrop) {
      this.lobbyBackdrop.setPosition(gameSize.width / 2, gameSize.height / 2);
      this.lobbyBackdrop.setSize(gameSize.width, gameSize.height);
      this.lobbyTitle.setPosition(gameSize.width / 2, 120);
      this.lobbySubtitle.setPosition(gameSize.width / 2, 185);
      this.playersListText.setPosition(gameSize.width / 2, 270);
      this.lobbyMessage.setPosition(gameSize.width / 2, gameSize.height - 180);
      this.startButtonRect.setPosition(gameSize.width / 2, gameSize.height - 95);
      this.startButtonLabel.setPosition(gameSize.width / 2, gameSize.height - 95);
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
  }

  onLobbyState(payload = {}) {
    this.currentLobbyState = payload;
    this.renderLobbyState();
    this.setWeatherControlsVisible(this.matchRunning && !this.matchEnded);
    this.refreshItemUi();
  }

  onRoomError(payload = {}) {
    this.lobbyMessage.setText(payload.message || "Error de sala.");
    this.lobbyMessage.setColor("#ff9f9f");
    this.playersListText.setText([
      "No se pudo entrar a la sala.",
      "Revisa el backend y vuelve a intentar.",
    ]);
    if (this.nameInput && this.nameSubmitButton) {
      this.nameInput.disabled = false;
      this.nameSubmitButton.disabled = false;
      this.nameSubmitButton.textContent = "Entrar";
      this.nameEntryRoot.style.display = "flex";
    }
  }

  onConnectError(error) {
    console.error("[socket-connect-error]", error);

    this.lobbyMessage.setText(
      "No se pudo conectar al servidor. Revisa la URL del backend."
    );
    this.lobbyMessage.setColor("#ff9f9f");
    this.playersListText.setText([
      "Fallo la conexion al socket.",
      "Revisa VITE_SOCKET_SERVER_URL o el tunel del puerto 3000.",
    ]);

    if (this.nameInput && this.nameSubmitButton) {
      this.nameInput.disabled = false;
      this.nameSubmitButton.disabled = false;
      this.nameSubmitButton.textContent = "Entrar";
      this.nameEntryRoot.style.display = "flex";
    }
  }

  renderLobbyState() {
    if (!this.currentLobbyState) return;

    const players = this.currentLobbyState.players || [];
    const maxPlayers = this.currentLobbyState.maxPlayers || 4;
    const hostId = this.currentLobbyState.hostId;
    const isHost = this.multiplayer?.selfId === hostId;

    if (!this.isRegistered) {
      this.playersListText.setText(["Ingresa username para entrar a sala"]);
      this.lobbySubtitle.setText("Conectados: 0/4 | Maximo 4 jugadores");
      this.startButtonRect.setVisible(false);
      this.startButtonLabel.setVisible(false);
      this.lobbyMessage.setText("Escribe un username corto y presiona Entrar.");
      this.lobbyMessage.setColor("#ffd27d");
      return;
    }

    const lines = players.length
      ? players.map((player, index) => {
          const hostTag = player.id === hostId ? " (Host)" : "";
          return `${index + 1}. ${player.name}${hostTag}`;
        })
      : ["Sin jugadores"];
    this.playersListText.setText(lines);

    this.lobbySubtitle.setText(
      `Conectados: ${players.length}/${maxPlayers} | Maximo 4 jugadores`
    );

    const canStart = isHost && !this.currentLobbyState.started && players.length > 0;
    this.startButtonRect.setVisible(canStart);
    this.startButtonLabel.setVisible(canStart);
    this.startButtonRect.disableInteractive();
    if (canStart) {
      this.startButtonRect.setInteractive({ useHandCursor: true });
      this.lobbyMessage.setText("Eres host. Presiona PLAY para iniciar.");
      this.lobbyMessage.setColor("#95f5c8");
    } else if (!isHost) {
      this.lobbyMessage.setText("Esperando que el host inicie la partida...");
      this.lobbyMessage.setColor("#ffd27d");
    } else {
      this.lobbyMessage.setText("Conectando sala...");
      this.lobbyMessage.setColor("#ffd27d");
    }

    this.setWeatherControlsVisible(this.matchRunning && !this.matchEnded);
  }

  onGameStarted(payload = {}) {
    if (this.matchRunning) return;

    const players = payload.players || {};
    const objectiveSeed = Number(payload.startedAt || Date.now());
    const localState = players[this.multiplayer.selfId] || {
      ...ACTIVE_MAP.getSpawnPoint(),
      angle: 0,
    };

    this.map = ACTIVE_MAP.create(this, {
      worldWidth: DEFAULT_WORLD_WIDTH,
      worldHeight: DEFAULT_WORLD_HEIGHT,
      objectiveSeed,
      localPlayerId: this.multiplayer.selfId,
      onTrackItemTriggered: (trackItemPayload = {}) => {
        this.multiplayer?.emitTriggerTrackItem(
          trackItemPayload.id,
          trackItemPayload.type
        );
      },
      motoDamageInterceptor: (damage) =>
        this.shieldEffectSystem?.interceptMotoDamage?.(damage) ?? damage,
      packageDamageInterceptor: (damage) =>
        this.shieldEffectSystem?.interceptPackageDamage?.(damage) ?? damage,
      onObjectiveCompleted: (completed) =>
        this.routeRewardSystem?.handleCompletedObjective?.(completed),
    });

    this.moto = new Moto(this, localState.x, localState.y, this.inputSystem);
    this.moto.direction = localState.angle || 0;
    this.moto.sprite.setRotation(this.moto.direction);
    this.moto.sprite.body.updateFromGameObject();

    this.playersGroup = this.physics.add.group();
    this.playersGroup.add(this.moto.sprite);
    this.physics.add.collider(this.playersGroup, this.playersGroup);

    this.multiplayer.attachGroup(this.playersGroup);
    this.multiplayer.attachLocalSprite(this.moto.sprite, localState);
    this.multiplayer.syncPlayers(players);

    const cam = this.cameras.main;
    cam.setBounds(
      0,
      0,
      this.map?.worldWidth || DEFAULT_WORLD_WIDTH,
      this.map?.worldHeight || DEFAULT_WORLD_HEIGHT
    );
    cam.setZoom(CAMERA_ZOOM_SETTINGS.baseZoom);
    cam.startFollow(this.moto.sprite, false, 1, 1);
    this.handleResize(this.scale.gameSize);

    this.hud = new DebugHUD(this);
    this.ensureEffectCamera();
    this.ensureHudCamera();
    this.matchRunning = true;
    this.matchEnded = false;
    this.finishSent = false;
    this.matchResultText = "";
    this.finishWindowEndsAtMs = 0;
    this.hud?.hideResults();
    this.simulationAccumulatorMs = 0;
    this.noCatchUpFrames = STARTUP_STABILIZE_FRAMES;
    this.clearLocalWeatherEventState();
    this.map?.endTrainEvent?.();
    this.setWeatherControlsVisible(true);
    this.itemInventoryState = createInventoryState([]);
    this.refreshItemUi();
    this.setItemUiVisible(true);
    this.positiveStockSystem?.resetForMatch();
    this.shieldEffectSystem?.reset();
    this.routeRewardSystem?.reset();
    this.refreshPositiveStockUi();
    this.setPositiveStockUiVisible(true);
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = false;
    this.applyEmpHudSuppression(false);
    this.applyHudCameraFilters();

    this.setLobbyVisible(false);
    this.statusBanner.setVisible(false);
  }

  onFinishWindowStarted(payload = {}) {
    if (!this.matchRunning || this.matchEnded) return;
    this.finishWindowEndsAtMs = Number(payload.endsAt || 0);

    const leaderName = payload.leaderName || "Jugador";
    this.statusBanner.setText(`Llego ${leaderName}. Ventana final: 20s`);
    this.statusBanner.setColor("#ffd27d");
    this.statusBanner.setVisible(true);
  }

  onMatchFinished(payload = {}) {
    if (!this.matchRunning) return;
    this.matchEnded = true;
    this.finishWindowEndsAtMs = 0;
    this.matchResultText = this.buildMatchResultText(payload);

    const winnerEntry = payload.results?.find(
      (entry) => entry.id === payload.winnerId
    );
    const winnerName = winnerEntry?.name || "Jugador";
    const winnerTime = Number.isFinite(winnerEntry?.elapsedMs)
      ? `${(winnerEntry.elapsedMs / 1000).toFixed(2)}s`
      : "N/A";
    const winnerScore = Number.isFinite(winnerEntry?.score)
      ? `${winnerEntry.score} pts`
      : "N/A";

    const isWinner = payload.winnerId && payload.winnerId === this.multiplayer.selfId;
    this.statusBanner.setText(
      isWinner
        ? `Ganaste | ${winnerScore} | ${winnerTime}`
        : `Perdiste | Gano ${winnerName} (${winnerScore})`
    );
    this.statusBanner.setColor(isWinner ? "#a7ffb8" : "#ff9f9f");
    this.statusBanner.setVisible(true);
    this.hud?.showResults(
      payload.results || [],
      payload.winnerId || null,
      this.multiplayer?.selfId || null
    );
    this.clearLocalWeatherEventState();
    this.map?.endTrainEvent?.();
    this.setWeatherControlsVisible(false);
    this.setItemUiVisible(false);
    this.setPositiveStockUiVisible(false);
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = true;
    this.applyEmpHudSuppression(false);

    const isHost = this.currentLobbyState?.hostId === this.multiplayer.selfId;
    if (isHost) {
      this.lobbyMessage.setText("Presiona R para reiniciar la sala.");
      this.lobbyMessage.setColor("#95f5c8");
    } else {
      this.lobbyMessage.setText("Esperando reinicio del host...");
      this.lobbyMessage.setColor("#ffd27d");
    }
  }

  onLobbyRestarted() {
    this.scene.restart();
  }

  onWeatherEventQueued(payload = {}) {
    this.applyWeatherEventPayload(payload, "countdown");
  }

  onWeatherEventStarted(payload = {}) {
    this.applyWeatherEventPayload(payload, "active");
  }

  onWeatherEventEnded() {
    this.clearLocalWeatherEventState();
  }

  onTrainEventStarted(payload = {}) {
    this.map?.startTrainEvent?.(payload);
  }

  onTrainEventEnded(payload = {}) {
    this.map?.endTrainEvent?.(payload);
  }

  onTrackItemsSnapshot(payload = {}) {
    this.map?.setTrackItems?.(payload.items || []);
  }

  onTrackItemAdded(payload = {}) {
    this.map?.upsertTrackItem?.(payload);
  }

  onTrackItemUpdated(payload = {}) {
    this.map?.upsertTrackItem?.(payload);
  }

  onTrackItemRemoved(payload = {}) {
    this.map?.removeTrackItem?.(payload.id);
  }

  onInventoryState(payload = {}) {
    this.itemInventoryState = payload;
    this.refreshItemUi();
  }

  onInventoryItemActivated(payload = {}) {
    if (!this.matchRunning) return;
    if (payload.type !== ITEM_TYPES.SHIELD) return;
    if (this.shieldEffectSystem?.activate(this.map?.getMotoMaxHealth?.())) {
      this.statusBanner.setText("Escudo activo");
      this.statusBanner.setColor("#7fe7ff");
      this.statusBanner.setVisible(true);
    }
  }

  onEmpPulseStarted(payload = {}) {
    this.empPulseVisual?.trigger({
      ...payload,
      color: ITEM_CONFIG[ITEM_TYPES.EMP].draw.color,
      ringColor: ITEM_CONFIG[ITEM_TYPES.EMP].draw.ringColor,
    });

    if (!this.matchRunning || !this.moto) return;
    if (payload.ownerId === this.multiplayer?.selfId) return;

    const radius = Math.max(80, Number(payload.radius || ITEM_CONFIG[ITEM_TYPES.EMP].radius));
    const distance = Math.hypot(
      Number(payload.x || 0) - this.moto.sprite.x,
      Number(payload.y || 0) - this.moto.sprite.y
    );
    if (distance > radius) return;

    this.moto.applyEmpEffect({
      durationMs:
        Number(payload.effectDurationMs || ITEM_CONFIG[ITEM_TYPES.EMP].effectDurationMs),
      initialSpeedFactor: ITEM_CONFIG[ITEM_TYPES.EMP].initialSpeedFactor,
      handling: ITEM_CONFIG[ITEM_TYPES.EMP].handling,
    });
    this.startEmpHudSuppression(
      Number(payload.effectDurationMs || ITEM_CONFIG[ITEM_TYPES.EMP].effectDurationMs)
    );
    this.cameras.main.shake(280, 0.005);
  }

  startEmpHudSuppression(durationMs) {
    const safeDurationMs = Math.max(200, Number(durationMs || 0));
    if (this.empHudSuppressedUntilMs <= this.time.now) {
      this.statusBannerVisibleBeforeEmp = Boolean(this.statusBanner?.visible);
    }
    this.empHudSuppressedUntilMs = Math.max(
      this.empHudSuppressedUntilMs,
      this.time.now + safeDurationMs
    );
    this.applyEmpHudSuppression(true);
  }

  applyEmpHudSuppression(suppressed) {
    this.hud?.setVisible?.(!suppressed);
    this.statusBanner?.setVisible(
      suppressed ? false : Boolean(this.statusBannerVisibleBeforeEmp)
    );
    this.weatherEventText?.setVisible(!suppressed && this.matchRunning);
    this.weatherHintText?.setVisible(
      !suppressed && this.matchRunning && this.isLocalHost()
    );
    this.weatherButtons.forEach((button) => {
      const visible = !suppressed && this.isLocalHost() && !this.matchEnded;
      button.background.setVisible(visible);
      button.label.setVisible(visible);
      button.background.disableInteractive();
      if (visible) {
        button.background.setInteractive({ useHandCursor: true });
      }
    });
    this.itemPanel?.setVisible(!suppressed && this.matchRunning && !this.matchEnded);
    this.itemPanel?.setHostControlsVisible(
      !suppressed && this.matchRunning && !this.matchEnded && this.isLocalHost()
    );
    this.stockPanel?.setVisible(!suppressed && this.matchRunning && !this.matchEnded);
    this.map?.setGuideSuppressed?.(suppressed);
  }

  ensureHudCamera() {
    const { width, height } = this.scale.gameSize;
    if (!this.hudCamera) {
      this.hudCamera = this.cameras.add(0, 0, width, height);
      this.hudCamera.setName("hud-camera");
    } else {
      this.hudCamera.setViewport(0, 0, width, height);
    }

    this.hudCamera.setScroll(0, 0);
    this.hudCamera.setZoom(CAMERA_ZOOM_SETTINGS.hudBaseZoom);
  }

  ensureEffectCamera() {
    const { width, height } = this.scale.gameSize;
    if (!this.effectCamera) {
      this.effectCamera = this.cameras.add(0, 0, width, height);
      this.effectCamera.setName("effects-camera");
    } else {
      this.effectCamera.setViewport(0, 0, width, height);
    }

    this.effectCamera.setScroll(0, 0);
    this.effectCamera.setBackgroundColor("rgba(0, 0, 0, 0)");
  }

  applyHudCameraFilters() {
    if (!this.hud || !this.hudCamera) return;

    const mainCam = this.cameras.main;
    const hudObjects = new Set(this.hud.getHudObjects?.() || []);
    const effectObjects = new Set(this.nightVisionOverlay?.getObjects?.() || []);

    this.children.list.forEach((gameObject) => {
      if (!gameObject) return;
      if (effectObjects.has(gameObject)) {
        mainCam.ignore(gameObject);
        this.hudCamera.ignore(gameObject);
      } else if (hudObjects.has(gameObject) || gameObject.__isHudObject) {
        this.effectCamera?.ignore(gameObject);
        mainCam.ignore(gameObject);
      } else {
        this.hudCamera.ignore(gameObject);
        this.effectCamera?.ignore(gameObject);
      }
    });
  }

  resetToLobby() {
    if (this.moto) {
      this.moto.sprite.destroy();
      this.moto = null;
    }
    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }
    if (this.hudCamera) {
      this.cameras.remove(this.hudCamera);
      this.hudCamera = null;
    }
    if (this.effectCamera) {
      this.cameras.remove(this.effectCamera);
      this.effectCamera = null;
    }

    this.map = null;
    this.matchRunning = false;
    this.matchEnded = false;
    this.finishSent = false;
    this.finishWindowEndsAtMs = 0;
    this.matchResultText = "";
    this.hud?.hideResults();
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.hudFilterAccumulatorMs = 0;
    this.simulationAccumulatorMs = 0;
    this.noCatchUpFrames = STARTUP_STABILIZE_FRAMES;
    this.clearLocalWeatherEventState();
    this.map?.endTrainEvent?.();
    this.setWeatherControlsVisible(false);
    this.itemInventoryState = createInventoryState([]);
    this.refreshItemUi();
    this.setItemUiVisible(false);
    this.positiveStockSystem?.resetForMatch();
    this.shieldEffectSystem?.reset();
    this.routeRewardSystem?.reset();
    this.refreshPositiveStockUi();
    this.setPositiveStockUiVisible(false);
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = false;
    this.applyEmpHudSuppression(false);

    this.multiplayer?.attachGroup(null);
    this.setLobbyVisible(true);
    this.statusBanner.setVisible(false);
    this.renderLobbyState();
  }

  setLobbyVisible(visible) {
    this.lobbyBackdrop.setVisible(visible);
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
      this.startButtonRect.setVisible(false);
      this.startButtonLabel.setVisible(false);
      if (this.nameEntryRoot) {
        this.nameEntryRoot.style.display = "none";
      }
    }
  }

  onVisibilityChange() {
    this.simulationAccumulatorMs = 0;
    this.game.loop.resetDelta?.();
    if (!document.hidden) {
      this.noCatchUpFrames = RESUME_STABILIZE_FRAMES;
    }
  }

  runSimulationStep(stepMs) {
    if (!this.moto || !this.map) return;

    this.moto.setShieldVisualActive?.(
      Boolean(this.shieldEffectSystem?.getState?.().active)
    );
    const playerLocked =
      this.matchEnded ||
      (this.map.isPlayerLocked?.() ?? false) ||
      (this.map.isRiderRepairing?.() ?? false);
    if (playerLocked) {
      this.moto.haltMotion();
    } else {
      this.moto.update(stepMs);
    }
    this.map.enforcePlayer(this.moto, stepMs);
    this.moto.setShieldVisualActive?.(
      Boolean(this.shieldEffectSystem?.getState?.().active)
    );
  }

  isLocalHost() {
    return this.currentLobbyState?.hostId === this.multiplayer?.selfId;
  }

  applyWeatherEventPayload(payload = {}, phase = "active") {
    if (!this.matchRunning || !this.moto) return;

    const config = WEATHER_EVENT_CONFIG[payload.type];
    if (!config) return;

    const startsAtMs = Number(payload.startsAt || payload.startedAt || Date.now());
    const endsAtMs = Number(
      payload.endsAt || payload.startedAt + config.durationMs || Date.now()
    );

    this.weatherEvent = {
      type: config.type,
      phase,
      label: payload.label || config.label,
      startsAtMs,
      endsAtMs,
      overlayColor: config.overlayColor,
      overlayAlpha: config.overlayAlpha,
      accentColor: config.accentColor,
      source: payload.source || "",
    };

    if (config.type === WEATHER_EVENT_TYPES.NIGHT) {
      this.weatherOverlay?.setVisible(false);
      this.weatherOverlay?.setAlpha(0);
      this.weatherOverlayAlpha = 0;
    } else {
      this.weatherOverlay?.setFillStyle(config.overlayColor, 1);
      this.weatherOverlay?.setVisible(true);
    }

    if (phase === "active") {
      this.moto.setWeatherEvent({
        type: config.type,
        handling: config.handling,
        heat: config.heat,
      });
    } else {
      this.moto.setWeatherEvent(null);
    }
    this.refreshWeatherUi();
  }

  clearLocalWeatherEventState() {
    this.weatherEvent = this.createEmptyWeatherEventState();
    this.moto?.setWeatherEvent(null);
    this.nightVisionOverlay?.setActive(false);
    this.refreshWeatherUi();
  }

  updateWeatherEvent(deltaMs) {
    if (
      this.weatherEvent.phase === "active" &&
      this.weatherEvent.type !== WEATHER_EVENT_TYPES.NONE &&
      Date.now() >= this.weatherEvent.endsAtMs
    ) {
      this.clearLocalWeatherEventState();
    }

    const overlayTargetAlpha =
      this.matchRunning &&
      this.weatherEvent.phase === "active" &&
      this.weatherEvent.type !== WEATHER_EVENT_TYPES.NIGHT
        ? this.weatherEvent.overlayAlpha
        : 0;
    this.weatherOverlayAlpha = damp(
      this.weatherOverlayAlpha,
      overlayTargetAlpha,
      WEATHER_OVERLAY_DAMPING,
      deltaMs
    );

    if (this.weatherOverlay) {
      this.weatherOverlay.setAlpha(this.weatherOverlayAlpha);
      this.weatherOverlay.setVisible(this.weatherOverlayAlpha > 0.01);
    }
    const isNightActive =
      this.matchRunning &&
      this.weatherEvent.phase === "active" &&
      this.weatherEvent.type === WEATHER_EVENT_TYPES.NIGHT;
    const nightConfig = WEATHER_EVENT_CONFIG[WEATHER_EVENT_TYPES.NIGHT].nightVision || {};
    this.nightVisionOverlay?.setActive(isNightActive, {
      blockedRatio: nightConfig.blockedRatio ?? 0.35,
      color: nightConfig.color ?? 0x000000,
      alpha: nightConfig.alpha ?? 1,
    });

    this.refreshWeatherUi();
  }

  syncNightVisionFocus() {
    if (!this.nightVisionOverlay || !this.moto) return;

    const cam = this.cameras.main;
    if (!cam) return;

    cam.preRender();
    const worldView = cam.worldView;
    const screenX =
      ((this.moto.sprite.x - worldView.x) / Math.max(1, worldView.width)) * cam.width + cam.x;
    const screenY =
      ((this.moto.sprite.y - worldView.y) / Math.max(1, worldView.height)) * cam.height + cam.y;
    this.nightVisionOverlay.setFocus(screenX, screenY);
  }

  updateCameraAndHud(deltaMs) {
    if (!this.moto || !this.hud || !this.map) return;

    const cam = this.cameras.main;
    const speedRatio = Phaser.Math.Clamp(
      this.moto.speedPxPerSec / this.moto.maxSpeedPxPerSec,
      0,
      1
    );
    const speedKmh = speedPxPerSecToKmh(this.moto.speedPxPerSec);
    const highSpeedBlend = Phaser.Math.Clamp(
      (speedKmh - HIGH_SPEED_CAMERA_FEEL.triggerKmh) /
        HIGH_SPEED_CAMERA_FEEL.blendRangeKmh,
      0,
      1
    );
    const topSpeedBlend = Phaser.Math.Clamp(
      (speedKmh - TOP_SPEED_SCREEN_FX.triggerKmh) /
        TOP_SPEED_SCREEN_FX.blendRangeKmh,
      0,
      1
    );
    const topSpeedIntensity =
      speedKmh >= TOP_SPEED_SCREEN_FX.triggerKmh
        ? TOP_SPEED_SCREEN_FX.baseIntensityAtTrigger +
          (1 - TOP_SPEED_SCREEN_FX.baseIntensityAtTrigger) * topSpeedBlend
        : 0;
    const now = this.time.now;

    const baseTargetZoom = Phaser.Math.Linear(
      CAMERA_ZOOM_SETTINGS.baseZoom,
      CAMERA_ZOOM_SETTINGS.fastZoom,
      speedRatio
    );
    const highSpeedZoomPulse =
      Math.sin(now * HIGH_SPEED_CAMERA_FEEL.offsetWaveFreqX) *
      HIGH_SPEED_CAMERA_FEEL.zoomPulseAmplitude *
      highSpeedBlend;
    const topSpeedZoomPulse =
      Math.sin(now * TOP_SPEED_SCREEN_FX.shakeFreqX) *
      TOP_SPEED_SCREEN_FX.zoomPulseAmplitude *
      topSpeedIntensity;
    const targetZoom =
      baseTargetZoom -
      HIGH_SPEED_CAMERA_FEEL.maxExtraZoomOut * highSpeedBlend -
      TOP_SPEED_SCREEN_FX.extraZoomOut * topSpeedIntensity +
      highSpeedZoomPulse +
      topSpeedZoomPulse;
    const viewportWidth = this.scale.gameSize.width || DESIGN_VIEWPORT_WIDTH;
    const viewportHeight = this.scale.gameSize.height || DESIGN_VIEWPORT_HEIGHT;
    const viewportScale = Math.max(
      viewportWidth / DESIGN_VIEWPORT_WIDTH,
      viewportHeight / DESIGN_VIEWPORT_HEIGHT
    );
    const compensatedScale = Phaser.Math.Linear(
      1,
      viewportScale,
      CAMERA_ZOOM_SETTINGS.viewportCompensation
    );
    const compensatedZoom = targetZoom * compensatedScale;
    cam.setZoom(damp(cam.zoom, compensatedZoom, ZOOM_DAMPING, deltaMs));
    if (this.hudCamera) {
      const hudTargetZoom = Phaser.Math.Linear(
        CAMERA_ZOOM_SETTINGS.hudBaseZoom,
        CAMERA_ZOOM_SETTINGS.hudFastZoom,
        speedRatio
      );
      this.hudCamera.setZoom(
        damp(
          this.hudCamera.zoom,
          hudTargetZoom,
          CAMERA_ZOOM_SETTINGS.hudDamping,
          deltaMs
        )
      );
    }

    const lookAheadDistance = CAMERA_LOOK_AHEAD_MAX * speedRatio;
    const speedWaveAmplitude =
      HIGH_SPEED_CAMERA_FEEL.offsetWaveAmplitudePx * highSpeedBlend;
    const speedWaveX =
      Math.sin(now * HIGH_SPEED_CAMERA_FEEL.offsetWaveFreqX) *
      speedWaveAmplitude;
    const speedWaveY =
      Math.cos(now * HIGH_SPEED_CAMERA_FEEL.offsetWaveFreqY) *
      speedWaveAmplitude *
      0.25;
    const horizontalShakeWave =
      Math.sin(now * TOP_SPEED_SCREEN_FX.shakeFreqX) +
      Math.sin(now * TOP_SPEED_SCREEN_FX.shakeFreqXSecondary) *
        TOP_SPEED_SCREEN_FX.shakeSecondaryWeight;
    const topShakeX =
      horizontalShakeWave *
      TOP_SPEED_SCREEN_FX.shakeAmplitudePx *
      topSpeedIntensity;
    const topShakeY =
      Math.sin(now * TOP_SPEED_SCREEN_FX.shakeFreqY) *
      TOP_SPEED_SCREEN_FX.verticalDriftPx *
      topSpeedIntensity;
    const targetOffsetX =
      Math.cos(this.moto.direction) * lookAheadDistance + speedWaveX + topShakeX;
    const targetOffsetY =
      Math.sin(this.moto.direction) * lookAheadDistance + speedWaveY + topShakeY;
    this.cameraOffsetX = damp(
      this.cameraOffsetX,
      targetOffsetX,
      OFFSET_DAMPING,
      deltaMs
    );
    this.cameraOffsetY = damp(
      this.cameraOffsetY,
      targetOffsetY,
      OFFSET_DAMPING,
      deltaMs
    );
    cam.setFollowOffset(this.cameraOffsetX, this.cameraOffsetY);
    this.syncNightVisionFocus();
    const mapHudInfo = this.map.getHudInfo?.(this.moto) || {};
    this.refreshPositiveStockUi();
    const finishWindowRemainingMs = this.finishWindowEndsAtMs
      ? Math.max(0, this.finishWindowEndsAtMs - Date.now())
      : 0;
    const motoHudInfo = {
      ...(mapHudInfo.moto || {}),
      ...(this.moto.getHudState?.() || {}),
    };
    this.hud.update(this.moto, deltaMs, {
      ...mapHudInfo,
      moto: motoHudInfo,
      timing: {
        ...(mapHudInfo.timing || {}),
        finishWindowRemainingMs,
      },
      resultText: this.matchResultText,
    });
  }

  buildMatchResultText(payload = {}) {
    const results = Array.isArray(payload.results) ? payload.results : [];
    if (!results.length) return "";

    const myId = this.multiplayer?.selfId;
    const myEntry = results.find((entry) => entry.id === myId);
    const myPosition = myEntry
      ? results.findIndex((entry) => entry.id === myId) + 1
      : 0;

    if (!myEntry || myPosition <= 0) return "";

    if (!myEntry.didFinish) {
      const scoreText = Number.isFinite(myEntry.score) ? `${myEntry.score} pts` : "0 pts";
      return `Pos ${myPosition}/${results.length} | ${scoreText} | DNF`;
    }

    const qualityText = `${myEntry.qualityPercent}%`;
    const timeText = `${(myEntry.elapsedMs / 1000).toFixed(2)}s`;
    const scoreText = Number.isFinite(myEntry.score) ? `${myEntry.score} pts` : "N/A";
    return `Pos ${myPosition}/${results.length} | ${scoreText} | ${timeText} | Calidad ${qualityText}`;
  }

  update(_time, delta) {
    this.multiplayer?.update(delta);
    this.empPulseVisual?.update();

    if (!this.matchRunning) return;

    if (this.isLocalHost() && Phaser.Input.Keyboard.JustDown(this.rainEventKey)) {
      this.multiplayer?.emitQueueWeatherEvent(WEATHER_EVENT_TYPES.RAIN);
    }
    if (this.isLocalHost() && Phaser.Input.Keyboard.JustDown(this.sunnyEventKey)) {
      this.multiplayer?.emitQueueWeatherEvent(WEATHER_EVENT_TYPES.SUNNY);
    }
    if (this.isLocalHost() && Phaser.Input.Keyboard.JustDown(this.nightEventKey)) {
      this.multiplayer?.emitQueueWeatherEvent(WEATHER_EVENT_TYPES.NIGHT);
    }
    if (
      this.isLocalHost() &&
      Phaser.Input.Keyboard.JustDown(this.clearWeatherEventKey)
    ) {
      this.multiplayer?.emitClearWeatherEvent();
    }
    if (this.isLocalHost() && Phaser.Input.Keyboard.JustDown(this.trainEventKey)) {
      this.multiplayer?.emitStartTrainEvent();
    }
    if (
      this.isLocalHost() &&
      (Phaser.Input.Keyboard.JustDown(this.grantOilKey) ||
        Phaser.Input.Keyboard.JustDown(this.grantOilNumpadKey))
    ) {
      this.multiplayer?.emitGrantItem(ITEM_TYPES.OIL);
    }
    if (
      this.isLocalHost() &&
      (Phaser.Input.Keyboard.JustDown(this.grantWallKey) ||
        Phaser.Input.Keyboard.JustDown(this.grantWallNumpadKey))
    ) {
      this.multiplayer?.emitGrantItem(ITEM_TYPES.WALL);
    }
    if (
      this.isLocalHost() &&
      (Phaser.Input.Keyboard.JustDown(this.grantEmpKey) ||
        Phaser.Input.Keyboard.JustDown(this.grantEmpNumpadKey))
    ) {
      this.multiplayer?.emitGrantItem(ITEM_TYPES.EMP);
    }
    if (Phaser.Input.Keyboard.JustDown(this.dropItemKey)) {
      this.multiplayer?.emitDropItem();
    }
    if (Phaser.Input.Keyboard.JustDown(this.turboKey)) {
      if (this.positiveStockSystem?.useTurbo(this.moto)) {
        this.refreshPositiveStockUi();
        this.cameras.main.shake(140, 0.0022);
      }
    }

    if (this.empHudSuppressedUntilMs > 0) {
      const stillSuppressed = this.time.now < this.empHudSuppressedUntilMs;
      this.applyEmpHudSuppression(stillSuppressed);
      if (!stillSuppressed) {
        this.empHudSuppressedUntilMs = 0;
        this.refreshWeatherUi();
        this.refreshItemUi();
        this.refreshPositiveStockUi();
      }
    }

    this.hudFilterAccumulatorMs += delta;
    if (this.hudFilterAccumulatorMs >= HUD_FILTER_REFRESH_MS) {
      this.hudFilterAccumulatorMs = 0;
      this.applyHudCameraFilters();
    }

    if (
      this.matchEnded &&
      Phaser.Input.Keyboard.JustDown(this.restartLevelKey) &&
      this.currentLobbyState?.hostId === this.multiplayer.selfId
    ) {
      this.multiplayer.emitRestartLobby();
      return;
    }

    const cappedDelta = Math.min(delta, MAX_ACCUMULATED_DELTA_MS);
    const presentationDelta = Math.min(cappedDelta, CAMERA_DELTA_CAP_MS);
    this.updateWeatherEvent(presentationDelta);

    if (cappedDelta >= DELTA_SPIKE_RESET_MS) {
      this.simulationAccumulatorMs = 0;
      this.noCatchUpFrames = Math.max(
        this.noCatchUpFrames,
        RESUME_STABILIZE_FRAMES
      );
    }

    if (this.noCatchUpFrames > 0) {
      this.noCatchUpFrames -= 1;
      this.simulationAccumulatorMs = 0;
      this.runSimulationStep(FIXED_STEP_MS);
      this.updateCameraAndHud(presentationDelta);
    } else {
      this.simulationAccumulatorMs += cappedDelta;
      let catchUpSteps = 0;
      while (
        this.simulationAccumulatorMs >= FIXED_STEP_MS &&
        catchUpSteps < MAX_CATCH_UP_STEPS
      ) {
        this.runSimulationStep(FIXED_STEP_MS);
        this.simulationAccumulatorMs -= FIXED_STEP_MS;
        catchUpSteps += 1;
      }
      if (catchUpSteps === MAX_CATCH_UP_STEPS) {
        this.simulationAccumulatorMs = 0;
      }
      this.updateCameraAndHud(presentationDelta);
    }

    if (
      !this.finishSent &&
      !this.matchEnded &&
      this.map?.isMatchFinished?.()
    ) {
      this.finishSent = true;
      const stats = this.map?.getMatchStats?.() || {};
      this.multiplayer?.emitFinishMatch(stats);
    }
  }
}


