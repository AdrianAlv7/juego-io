// Flujo de partida y lobby del GameScene.
// Maneja conexion inicial, errores de sala, arranque de match, cierre de match y texto de resultados.
import Moto from "../../entities/moto.js";
import { createInventoryState } from "../../items/catalog.js";
import { ACTIVE_MAP } from "../../world/activeMap.js";
import GameplayHudKitOverlay from "../../ui/GameplayHudKitOverlay.js";
import {
  CAMERA_ZOOM_SETTINGS,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  STARTUP_STABILIZE_FRAMES,
} from "./constants.js";

function createHud(scene) {
  return new GameplayHudKitOverlay(scene);
}

function createMatchMap(scene, objectiveSeed) {
  return ACTIVE_MAP.create(scene, {
    worldWidth: DEFAULT_WORLD_WIDTH,
    worldHeight: DEFAULT_WORLD_HEIGHT,
    objectiveSeed,
    localPlayerId: scene.multiplayer.selfId,
    onTrackItemTriggered: (trackItemPayload = {}) => {
      scene.multiplayer?.emitTriggerTrackItem(
        trackItemPayload.id,
        trackItemPayload.type
      );
    },
    motoDamageInterceptor: (damage) =>
      scene.shieldEffectSystem?.interceptMotoDamage?.(damage) ?? damage,
    packageDamageInterceptor: (damage) =>
      scene.shieldEffectSystem?.interceptPackageDamage?.(damage) ?? damage,
    onObjectiveCompleted: (completed) =>
      scene.routeRewardSystem?.handleCompletedObjective?.(completed),
  });
}

function createLocalMoto(scene, localState) {
  const moto = new Moto(scene, localState.x, localState.y, scene.inputSystem);
  moto.direction = localState.angle || 0;
  moto.sprite.setRotation(moto.direction);
  moto.sprite.body.updateFromGameObject();
  return moto;
}

export const gameSceneMatchMethods = {
  onLobbyState(payload = {}) {
    this.currentLobbyState = payload;
    this.renderLobbyState();
    this.setWeatherControlsVisible(this.matchRunning && !this.matchEnded);
    this.refreshItemUi();
    this.refreshPositiveStockUi();
    this.refreshDebugFinishUi();
    this.setDebugFinishUiVisible(this.matchRunning && !this.matchEnded);
  },

  onRoomError(payload = {}) {
    this.isRegistered = false;
    this.currentLobbyState = null;
    this.setNameEntryBusy(null);
    this.setLobbyMessage(payload.message || "Error de sala.", "#ff9f9f");
    this.playersListText.setText([
      "No se pudo entrar a la sala.",
      "Revisa el backend y vuelve a intentar.",
    ]);
    if (this.nameInput && this.nameEntryRoot) {
      this.nameInput.disabled = false;
      if (this.roomCodeInput) {
        this.roomCodeInput.disabled = false;
      }
      this.nameEntryRoot.style.display = "flex";
      this.nameInput.focus();
    }
    this.setLeaveRoomUiVisible(false);
    this.updateRoomShareUi();
  },

  onConnectError(error) {
    console.error("[socket-connect-error]", error);

    this.isRegistered = false;
    this.currentLobbyState = null;
    this.setNameEntryBusy(null);
    this.setLobbyMessage(
      "No se pudo conectar al servidor. Revisa la URL del backend.",
      "#ff9f9f"
    );
    this.playersListText.setText([
      "Fallo la conexion al socket.",
      "Revisa VITE_SOCKET_SERVER_URL o el tunel del puerto 3000.",
    ]);

    if (this.nameInput && this.nameEntryRoot) {
      this.nameInput.disabled = false;
      if (this.roomCodeInput) {
        this.roomCodeInput.disabled = false;
      }
      this.nameEntryRoot.style.display = "flex";
      this.nameInput.focus();
    }
    this.setLeaveRoomUiVisible(false);
    this.updateRoomShareUi();
  },

  renderLobbyState() {
    if (!this.currentLobbyState) {
      this.lobbyTitle.setText("Sala Repartidor.io");
      this.lobbySubtitle.setText("Publica o privada | Maximo 4 jugadores");
      this.playersListText.setText(["Elige un modo para entrar a una sala"]);
      this.setLobbyMessage("Busca publica, crea privada o entra con codigo.");
      this.startButtonRect.setVisible(false);
      this.startButtonLabel.setVisible(false);
      this.setLeaveRoomUiVisible(false);
      this.updateRoomShareUi();
      return;
    }

    const players = this.currentLobbyState.players || [];
    const maxPlayers = this.currentLobbyState.maxPlayers || 4;
    const hostId = this.currentLobbyState.hostId;
    const isHost = this.multiplayer?.selfId === hostId;
    const roomType = this.currentLobbyState.roomType || "public";
    const roomCode = this.currentLobbyState.roomCode || "";

    this.lobbyTitle.setText(
      roomType === "private"
        ? `Sala privada ${roomCode || ""}`.trim()
        : "Sala publica"
    );
    this.lobbySubtitle.setText(
      roomType === "private"
        ? `Codigo ${roomCode || "AUTO"} | Conectados: ${players.length}/${maxPlayers}`
        : `Emparejamiento publico | Conectados: ${players.length}/${maxPlayers}`
    );
    this.setLeaveRoomUiVisible(this.isRegistered && !this.matchRunning);
    this.updateRoomShareUi();

    if (!this.isRegistered) {
      this.playersListText.setText(["Ingresa username para entrar a sala"]);
      this.startButtonRect.setVisible(false);
      this.startButtonLabel.setVisible(false);
      this.setLobbyMessage(
        "Escribe username y elige publica, crear privada o unirte con codigo."
      );
      return;
    }

    const lines = players.length
      ? players.map((player, index) => {
          const hostTag = player.id === hostId ? " (Host)" : "";
          return `${index + 1}. ${player.name}${hostTag}`;
        })
      : ["Sin jugadores"];
    this.playersListText.setText(lines);

    const canStart = isHost && !this.currentLobbyState.started && players.length > 0;
    this.startButtonRect.setVisible(canStart);
    this.startButtonLabel.setVisible(canStart);
    this.startButtonRect.disableInteractive();
    if (canStart) {
      this.startButtonRect.setInteractive({ useHandCursor: true });
      this.setLobbyMessage(
        roomType === "private"
          ? `Eres host. Comparte el codigo ${roomCode || "AUTO"} y presiona PLAY cuando esten listos.`
          : "Eres host. Presiona PLAY para iniciar la sala publica.",
        "#95f5c8"
      );
    } else if (!isHost) {
      this.setLobbyMessage(
        roomType === "private"
          ? "Dentro de sala privada. Esperando que el host inicie la partida..."
          : "Emparejado en sala publica. Esperando que el host inicie la partida..."
      );
    } else {
      this.setLobbyMessage(
        roomType === "private"
          ? "Sala privada creada. Esperando mas jugadores..."
          : "Conectando sala publica..."
      );
    }

    this.setWeatherControlsVisible(this.matchRunning && !this.matchEnded);
  },

  onGameStarted(payload = {}) {
    if (this.matchRunning) return;

    const players = payload.players || {};
    const objectiveSeed = Number(payload.startedAt || Date.now());
    const localState = players[this.multiplayer.selfId] || {
      ...ACTIVE_MAP.getSpawnPoint(),
      angle: 0,
    };

    this.map = createMatchMap(this, objectiveSeed);
    this.moto = createLocalMoto(this, localState);

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

    this.hud = createHud(this);
    this.usingGameplayHudKit = Boolean(this.hud?.isGameplayHudKit);
    this.hud.setMinimapData(this.map?.getMinimapData?.() || null);
    this.ensureEffectCamera();
    this.ensureHudCamera();
    this.matchRunning = true;
    this.matchEnded = false;
    this.finishSent = false;
    this.matchResultText = "";
    this.finishWindowEndsAtMs = 0;
    this.lobbyReturnAtMs = 0;
    this.hud?.hideResults();
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
    this.refreshDebugFinishUi();
    this.setDebugFinishUiVisible(false);
    this.setLobbyReturnUiVisible(false);
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = false;
    this.applyEmpHudSuppression(false);
    this.applyHudCameraFilters();

    this.setLobbyVisible(false);
    this.setLeaveRoomUiVisible(false);
    this.updateRoomShareUi();
    this.statusBanner.setVisible(false);
    this.syncKeyboardCaptureState();
  },

  onFinishWindowStarted(payload = {}) {
    if (!this.matchRunning || this.matchEnded) return;
    this.finishWindowEndsAtMs = Number(payload.endsAt || 0);

    if (!this.usingGameplayHudKit) {
      const leaderName = payload.leaderName || "Jugador";
      this.statusBanner.setText(`Llego ${leaderName}. Ventana final: 20s`);
      this.statusBanner.setColor("#ffd27d");
      this.statusBanner.setVisible(true);
    }
  },

  onMatchFinished(payload = {}) {
    if (!this.matchRunning) return;
    this.matchEnded = true;
    this.finishWindowEndsAtMs = 0;
    this.lobbyReturnAtMs = Number(payload.lobbyResetAt || 0);
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

    const isWinner =
      payload.winnerId && payload.winnerId === this.multiplayer.selfId;
    if (!this.usingGameplayHudKit) {
      this.statusBanner.setText(
        isWinner
          ? `Ganaste | ${winnerScore} | ${winnerTime}`
          : `Perdiste | Gano ${winnerName} (${winnerScore})`
      );
      this.statusBanner.setColor(isWinner ? "#a7ffb8" : "#ff9f9f");
      this.statusBanner.setVisible(true);
    }
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
    this.setDebugFinishUiVisible(false);
    this.setLobbyReturnUiVisible(true);
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = true;
    this.applyEmpHudSuppression(false);
    this.syncKeyboardCaptureState();

    this.setLobbyMessage(
      "Puedes volver al lobby o esperar el cierre automatico."
    );
  },

  onLobbyRestarted() {
    if (this.currentLobbyState) {
      this.currentLobbyState = {
        ...this.currentLobbyState,
        started: false,
        finished: false,
        lobbyResetAt: 0,
      };
    }
    this.resetToLobby();
  },

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
      const scoreText = Number.isFinite(myEntry.score)
        ? `${myEntry.score} pts`
        : "0 pts";
      return `Pos ${myPosition}/${results.length} | ${scoreText} | DNF`;
    }

    const qualityText = `${myEntry.qualityPercent}%`;
    const timeText = `${(myEntry.elapsedMs / 1000).toFixed(2)}s`;
    const deltaText = Number.isFinite(myEntry.timeDeltaSeconds)
      ? ` | +${myEntry.timeDeltaSeconds}s`
      : "";
    const scoreText = Number.isFinite(myEntry.score)
      ? `${myEntry.score} pts`
      : "N/A";
    return `Pos ${myPosition}/${results.length} | ${scoreText} | ${timeText}${deltaText} | Calidad ${qualityText}`;
  },
};
