// Flujo de partida y lobby del GameScene.
// Maneja conexion inicial, errores de sala, arranque de match, cierre de match y texto de resultados.
import Moto from "../../entities/moto.js";
import { createInventoryState } from "../../items/catalog.js";
import { ACTIVE_MAP } from "../../world/activeMap.js";
import DebugHUD from "../../ui/DebugHUD.js";
import {
  CAMERA_ZOOM_SETTINGS,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  STARTUP_STABILIZE_FRAMES,
} from "./constants.js";

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
  },

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
  },

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

    this.hud = new DebugHUD(this);
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
    this.setWeatherControlsVisible(true);
    this.itemInventoryState = createInventoryState([]);
    this.refreshItemUi();
    this.setItemUiVisible(true);
    this.positiveStockSystem?.resetForMatch();
    this.shieldEffectSystem?.reset();
    this.routeRewardSystem?.reset();
    this.refreshPositiveStockUi();
    this.setPositiveStockUiVisible(true);
    this.refreshDebugFinishUi();
    this.setDebugFinishUiVisible(true);
    this.setLobbyReturnUiVisible(false);
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = false;
    this.applyEmpHudSuppression(false);
    this.applyHudCameraFilters();

    this.setLobbyVisible(false);
    this.statusBanner.setVisible(false);
    this.syncKeyboardCaptureState();
  },

  onFinishWindowStarted(payload = {}) {
    if (!this.matchRunning || this.matchEnded) return;
    this.finishWindowEndsAtMs = Number(payload.endsAt || 0);

    const leaderName = payload.leaderName || "Jugador";
    this.statusBanner.setText(`Llego ${leaderName}. Ventana final: 20s`);
    this.statusBanner.setColor("#ffd27d");
    this.statusBanner.setVisible(true);
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
    this.setDebugFinishUiVisible(false);
    this.setLobbyReturnUiVisible(true);
    this.empHudSuppressedUntilMs = 0;
    this.statusBannerVisibleBeforeEmp = true;
    this.applyEmpHudSuppression(false);
    this.syncKeyboardCaptureState();

    this.lobbyMessage.setText("Puedes volver al lobby o esperar el cierre automatico.");
    this.lobbyMessage.setColor("#ffd27d");
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
