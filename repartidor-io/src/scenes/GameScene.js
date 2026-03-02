import Phaser from "phaser";
import Moto from "../entities/moto.js";
import CityRaceMap from "../world/race/CityRaceMap.js";
import { CITY_RACE_LAYOUT } from "../world/race/config/cityRaceLayout.js";
import InputSystem from "../systems/InputSystem.js";
import DebugHUD from "../ui/DebugHUD.js";
import MultiplayerSystem from "../network/MultiplayerSystem.js";
import { speedPxPerSecToKmh } from "../world/race/utils/telemetry.js";

const WORLD_WIDTH = 6000;
const WORLD_HEIGHT = 6000;
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

    this.nameEntryRoot = null;
    this.nameInput = null;
    this.nameSubmitButton = null;

    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.matchResultText = "";
    this.finishWindowEndsAtMs = 0;
  }

  preload() {
    this.load.image("moto", "assets/moto.png");
  }

  create() {
    this.inputSystem = new InputSystem(this);
    this.restartLevelKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R
    );

    this.createLobbyUi();
    this.createStatusBanner();
    this.createNameEntryUi();

    this.multiplayer = new MultiplayerSystem(this, {
      spriteKey: "moto",
      callbacks: {
        onInit: () => this.onSocketInit(),
        onLobbyState: (payload) => this.onLobbyState(payload),
        onGameStarted: (payload) => this.onGameStarted(payload),
        onFinishWindowStarted: (payload) => this.onFinishWindowStarted(payload),
        onMatchFinished: (payload) => this.onMatchFinished(payload),
        onRoomError: (payload) => this.onRoomError(payload),
        onLobbyRestarted: () => this.onLobbyRestarted(),
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
      if (this.hudCamera) {
        this.cameras.remove(this.hudCamera);
        this.hudCamera = null;
      }
      this.multiplayer?.destroy();
      this.destroyNameEntryUi();
    });
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

    this.nameInput.value = safeName;
    this.nameInput.disabled = true;
    this.nameSubmitButton.disabled = true;
    this.nameSubmitButton.textContent = "Conectando...";
    this.lobbyMessage.setText("Conectando a sala...");
    this.lobbyMessage.setColor("#ffd27d");

    this.multiplayer.start({
      name: safeName,
      preferredSpawn: CITY_RACE_LAYOUT.spawnPoint,
    });
  }

  onSocketInit() {
    this.isRegistered = true;
    if (this.nameEntryRoot) {
      this.nameEntryRoot.style.display = "none";
    }
    this.renderLobbyState();
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
      this.multiplayer?.emitStartGame(CITY_RACE_LAYOUT.spawnPoint);
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
  }

  onRoomError(payload = {}) {
    this.lobbyMessage.setText(payload.message || "Error de sala.");
    this.lobbyMessage.setColor("#ff9f9f");
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
  }

  onGameStarted(payload = {}) {
    if (this.matchRunning) return;

    const players = payload.players || {};
    const localState = players[this.multiplayer.selfId] || {
      ...CITY_RACE_LAYOUT.spawnPoint,
      angle: 0,
    };

    this.map = new CityRaceMap(this, {
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
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
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.setZoom(CAMERA_ZOOM_SETTINGS.baseZoom);
    cam.startFollow(this.moto.sprite, false, 1, 1);
    this.handleResize(this.scale.gameSize);

    this.hud = new DebugHUD(this);
    this.ensureHudCamera();
    this.applyHudCameraFilters();

    this.matchRunning = true;
    this.matchEnded = false;
    this.finishSent = false;
    this.matchResultText = "";
    this.finishWindowEndsAtMs = 0;
    this.hud?.hideResults();
    this.simulationAccumulatorMs = 0;
    this.noCatchUpFrames = STARTUP_STABILIZE_FRAMES;

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

  applyHudCameraFilters() {
    if (!this.hud || !this.hudCamera) return;

    const mainCam = this.cameras.main;
    const hudObjects = new Set(this.hud.getHudObjects?.() || []);

    this.children.list.forEach((gameObject) => {
      if (!gameObject) return;
      if (hudObjects.has(gameObject) || gameObject.__isHudObject) {
        mainCam.ignore(gameObject);
      } else {
        this.hudCamera.ignore(gameObject);
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
    const viewportWidth = cam.width || this.scale.gameSize.width || DESIGN_VIEWPORT_WIDTH;
    const viewportHeight = cam.height || this.scale.gameSize.height || DESIGN_VIEWPORT_HEIGHT;
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
    const mapHudInfo = this.map.getHudInfo?.(this.moto) || {};
    const finishWindowRemainingMs = this.finishWindowEndsAtMs
      ? Math.max(0, this.finishWindowEndsAtMs - Date.now())
      : 0;
    this.hud.update(this.moto, deltaMs, {
      ...mapHudInfo,
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

    if (!this.matchRunning) return;

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


