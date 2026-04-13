// Flujo de partida y lobby del GameScene.
// Maneja conexion inicial, errores de sala, arranque de match, cierre de match y texto de resultados.
import Moto from "../../entities/moto.js";
import { getGarageMotoById } from "../../garage/catalog.js";
import { createInventoryState } from "../../items/catalog.js";
import appAudioManager from "../../ui/AppAudioManager.js";
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
    onObjectiveCompleted: (completed) => {
      scene.routeRewardSystem?.handleCompletedObjective?.(completed);
      appAudioManager.handleGameObjectiveCompleted(completed);
    },
    onObjectiveServiceStarted: (started) => {
      appAudioManager.handleGameObjectiveServiceStarted(started);
    },
  });
}

function createLocalMoto(scene, localState) {
  const selectedMoto = getGarageMotoById(
    localState?.motoId || scene.selectedGarageMotoId
  );
  scene.selectedGarageMotoId = selectedMoto.id;
  scene.selectedGarageMotoTextureKey = selectedMoto.textureKey;
  const moto = new Moto(
    scene,
    localState.x,
    localState.y,
    scene.inputSystem,
    selectedMoto.textureKey
  );
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
    this.lobbyPlayersPanel?.setVisible(false);
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
    this.readyButtonRect?.setVisible(false);
    this.readyButtonLabel?.setVisible(false);
    this.readyButtonRect?.disableInteractive();
    this.startButtonRect.setVisible(false);
    this.startButtonLabel.setVisible(false);
    this.startButtonRect.disableInteractive();
    this.setLeaveRoomUiVisible(false);
    this.updateRoomShareUi();
  },

  onConnectError(error) {
    console.error("[socket-connect-error]", error);

    this.isRegistered = false;
    this.currentLobbyState = null;
    this.lobbyPlayersPanel?.setVisible(false);
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
    this.readyButtonRect?.setVisible(false);
    this.readyButtonLabel?.setVisible(false);
    this.readyButtonRect?.disableInteractive();
    this.startButtonRect.setVisible(false);
    this.startButtonLabel.setVisible(false);
    this.startButtonRect.disableInteractive();
    this.setLeaveRoomUiVisible(false);
    this.updateRoomShareUi();
  },

  renderLobbyState() {
    if (!this.currentLobbyState) {
      this.lobbyCardNode?.classList.remove("is-private-room", "is-public-room");
      this.lobbyPlayersPanel?.setVisible(false);
      this.lobbyTitle.setText("Sala Deliver.io");
      this.lobbySubtitle.setText("Publica o privada | Maximo 6 jugadores");
      this.playersListText.setText([]);
      this.setGarageQuickUiVisible?.(false);
      this.refreshLobbyGaragePreview?.();
      this.setLobbyMessage("Escribe username y elige publica o privada.");
      this.readyButtonRect?.setVisible(false);
      this.readyButtonLabel?.setVisible(false);
      this.readyButtonRect?.disableInteractive();
      this.startButtonRect.setVisible(false);
      this.startButtonLabel.setVisible(false);
      this.startButtonRect.disableInteractive();
      this.setLeaveRoomUiVisible(false);
      this.updateRoomShareUi();
      this.lobbyCountdownLastSecond = -1;
      return;
    }

    const players = this.currentLobbyState.players || [];
    const maxPlayers = this.currentLobbyState.maxPlayers || 6;
    const hostId = this.currentLobbyState.hostId;
    const isHost = this.multiplayer?.selfId === hostId;
    const roomType = this.currentLobbyState.roomType || "public";
    const roomCode = this.currentLobbyState.roomCode || "";
    this.lobbyCardNode?.classList.toggle("is-private-room", roomType === "private");
    this.lobbyCardNode?.classList.toggle("is-public-room", roomType !== "private");
    const readyCount = Number.isFinite(this.currentLobbyState.readyCount)
      ? this.currentLobbyState.readyCount
      : players.filter((player) => player.ready).length;
    const allReady = players.length > 0 && readyCount >= players.length;
    const localPlayer = players.find(
      (player) => player.id === this.multiplayer?.selfId
    );
    if (localPlayer?.motoId) {
      const localMoto = getGarageMotoById(localPlayer.motoId);
      this.selectedGarageMotoId = localMoto.id;
      this.selectedGarageMotoTextureKey = localMoto.textureKey;
      if (!this.garageRoot?.classList.contains("is-open")) {
        this.garageWorkingMotoId = localMoto.id;
      }
    }
    const localReady = Boolean(localPlayer?.ready);
    const countdownEndsAt = Number(this.currentLobbyState.lobbyCountdownEndsAt || 0);
    const countdownActive = !this.currentLobbyState.started && countdownEndsAt > Date.now();
    const countdownSeconds = countdownActive
      ? Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000))
      : 0;
    this.lobbyCountdownLastSecond = countdownActive ? countdownSeconds : -1;

    this.lobbyPlayersPanel?.setVisible(this.isRegistered);
    this.setGarageQuickUiVisible?.(this.isRegistered);
    this.lobbyTitle.setText(
      roomType === "private"
        ? `Sala privada ${roomCode || ""}`.trim()
        : "Sala publica"
    );
    this.lobbySubtitle.setText(
      roomType === "private"
        ? `Codigo ${roomCode || "AUTO"} | Conectados: ${players.length}/${maxPlayers} | Listos: ${readyCount}/${players.length || 0}`
        : `Emparejamiento publico | Conectados: ${players.length}/${maxPlayers} | Listos: ${readyCount}/${players.length || 0}`
    );
    this.setLeaveRoomUiVisible(this.isRegistered && !this.matchRunning);
    this.updateRoomShareUi();
    this.refreshLobbyGaragePreview?.();

    if (!this.isRegistered) {
      this.lobbyPlayersPanel?.setVisible(false);
      this.setGarageQuickUiVisible?.(false);
      this.refreshLobbyGaragePreview?.();
      this.playersListText.setText([]);
      this.readyButtonRect?.setVisible(false);
      this.readyButtonLabel?.setVisible(false);
      this.readyButtonRect?.disableInteractive();
      this.startButtonRect.setVisible(false);
      this.startButtonLabel.setVisible(false);
      this.startButtonRect.disableInteractive();
      this.setLobbyMessage(
        "Escribe username y elige publica o privada."
      );
      return;
    }

    const lines = players.length
      ? players.map((player, index) => {
          const hostTag = player.id === hostId ? " (Creador)" : "";
          const readyTag = player.ready ? " [Listo]" : " [Esperando]";
          return `${index + 1}. ${player.name}${hostTag}${readyTag}`;
        })
      : ["Sin jugadores"];
    this.lobbyPlayersPanel?.setVisible(true);
    this.playersListText.setText(lines);
    this.refreshLobbyGaragePreview?.();
    this.syncLobbyGaragePreviewAlignment?.();

    const canToggleReady =
      !this.currentLobbyState.started && !this.matchRunning && players.length > 0;
    if (this.readyButtonNode) {
      this.readyButtonLabel?.setText(localReady ? "No listo" : "Listo");
      this.readyButtonNode.classList.toggle("lhl-btn-ready--active", localReady);
    }
    this.readyButtonRect?.setVisible(canToggleReady);
    this.readyButtonLabel?.setVisible(canToggleReady);
    this.readyButtonRect?.disableInteractive();
    if (canToggleReady) {
      this.readyButtonRect?.setInteractive({ useHandCursor: true });
    }

    const canStart =
      roomType === "private" &&
      isHost &&
      !this.currentLobbyState.started &&
      players.length > 0;
    this.startButtonRect.setVisible(canStart);
    this.startButtonLabel.setVisible(canStart);
    this.startButtonRect.disableInteractive();
    if (canStart) {
      this.startButtonRect.setInteractive({ useHandCursor: true });
    }

    if (countdownActive) {
      this.setLobbyMessage(
        roomType === "private"
          ? `Cuenta regresiva activa: ${countdownSeconds}s para iniciar partida.`
          : `Sala publica llena. Inicio automatico en ${countdownSeconds}s.`,
        countdownSeconds <= 3 ? "#95f5c8" : "#ffd27d"
      );
    } else if (roomType === "public") {
      const missingPlayers = Math.max(0, maxPlayers - players.length);
      if (missingPlayers > 0) {
        this.setLobbyMessage(
          `Faltan ${missingPlayers} jugador(es) para llenar la sala. Al llenarse inicia cuenta de 10s.`,
          "#8ad6ff"
        );
      } else if (!allReady) {
        this.setLobbyMessage(
          "Sala llena. Marca Listo para reducir la cuenta a 3 segundos.",
          "#ffd27d"
        );
      } else {
        this.setLobbyMessage(
          "Todos listos. El inicio se redujo a 3 segundos.",
          "#95f5c8"
        );
      }
    } else if (canStart) {
      this.setLobbyMessage(
        `Eres creador. Comparte codigo ${roomCode || "AUTO"} y presiona Empezar.`,
        "#95f5c8"
      );
    } else {
      this.setLobbyMessage(
        "Sala privada: espera al creador o marquense Listo para acelerar la cuenta.",
        "#8ad6ff"
      );
    }

    this.setWeatherControlsVisible(this.matchRunning && !this.matchEnded);
  },

  onGameStarted(payload = {}) {
    if (this.matchRunning) return;
    this.closeSettingsModal?.({ silent: true });

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
    appAudioManager.startGameMusic({ fadeOutMs: 220 });
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

    const roomType =
      this.currentLobbyState?.roomType || this.multiplayer?.getRoomInfo?.()?.roomType;
    this.setLobbyMessage(
      roomType === "public"
        ? "Partida publica finalizada. Puedes regresar al lobby o jugar otra publica."
        : "Puedes volver al lobby o esperar el cierre automatico."
    );
  },

  onLobbyRestarted() {
    if (this.currentLobbyState) {
      this.currentLobbyState = {
        ...this.currentLobbyState,
        players: Array.isArray(this.currentLobbyState.players)
          ? this.currentLobbyState.players.map((player) => ({
              ...player,
              ready: false,
            }))
          : [],
        started: false,
        finished: false,
        readyCount: 0,
        allReady: false,
        lobbyCountdownEndsAt: 0,
        lobbyCountdownDurationMs: 0,
        lobbyResetAt: 0,
      };
    }
    this.lobbyCountdownLastSecond = -1;
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
