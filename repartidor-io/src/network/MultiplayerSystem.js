import RemoteMoto from "./RemoteMoto.js";
import { createSocketConnection } from "./socketClient.js";

const SEND_INTERVAL_MS = 50;

export default class MultiplayerSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.spriteKey = options.spriteKey;
    this.playersGroup = options.playersGroup;
    this.callbacks = options.callbacks || {};

    this.socket = null;
    this.selfId = null;
    this.localSprite = null;
    this.gameStarted = false;
    this.remotePlayers = new Map();

    this.sendAccumulatorMs = 0;
    this.lastSentState = null;

    this.handleInitState = this.handleInitState.bind(this);
    this.handleLobbyState = this.handleLobbyState.bind(this);
    this.handleRoomError = this.handleRoomError.bind(this);
    this.handleGameStarted = this.handleGameStarted.bind(this);
    this.handlePlayerMoved = this.handlePlayerMoved.bind(this);
    this.handlePlayerDisconnected = this.handlePlayerDisconnected.bind(this);
    this.handleMatchFinished = this.handleMatchFinished.bind(this);
    this.handleLobbyRestarted = this.handleLobbyRestarted.bind(this);
  }

  start(registerPayload = {}) {
    this.socket = createSocketConnection();

    this.socket.on("initState", this.handleInitState);
    this.socket.on("lobbyState", this.handleLobbyState);
    this.socket.on("roomError", this.handleRoomError);
    this.socket.on("gameStarted", this.handleGameStarted);
    this.socket.on("playerMoved", this.handlePlayerMoved);
    this.socket.on("playerDisconnected", this.handlePlayerDisconnected);
    this.socket.on("matchFinished", this.handleMatchFinished);
    this.socket.on("lobbyRestarted", this.handleLobbyRestarted);

    this.socket.on("connect", () => {
      this.socket.emit("registerPlayer", registerPayload);
    });
  }

  attachGroup(playersGroup) {
    this.playersGroup = playersGroup;
  }

  attachLocalSprite(sprite, initialState = null) {
    this.localSprite = sprite;
    if (!initialState || !this.localSprite) return;
    this.localSprite.setPosition(initialState.x, initialState.y);
    this.localSprite.setRotation(initialState.angle || 0);
    this.localSprite.body?.updateFromGameObject();
  }

  handleInitState(payload = {}) {
    this.selfId = payload.selfId || null;
    this.callbacks.onInit?.(payload);
  }

  handleLobbyState(payload = {}) {
    this.callbacks.onLobbyState?.(payload);
  }

  handleRoomError(payload = {}) {
    this.callbacks.onRoomError?.(payload);
  }

  handleGameStarted(payload = {}) {
    this.gameStarted = true;
    this.clearRemotePlayers();
    this.callbacks.onGameStarted?.(payload);
  }

  handlePlayerMoved(payload = {}) {
    if (!this.gameStarted) return;
    const { id, ...state } = payload;
    if (!id || id === this.selfId) return;

    this.ensureRemotePlayer(id, state);
    this.remotePlayers.get(id).applyServerState(state);
  }

  handlePlayerDisconnected(payload = {}) {
    const { id } = payload;
    if (!id) return;
    const remote = this.remotePlayers.get(id);
    if (!remote) return;
    remote.destroy();
    this.remotePlayers.delete(id);
    this.callbacks.onPlayerDisconnected?.(id);
  }

  handleMatchFinished(payload = {}) {
    this.callbacks.onMatchFinished?.(payload);
  }

  handleLobbyRestarted() {
    this.gameStarted = false;
    this.clearRemotePlayers();
    this.localSprite = null;
    this.sendAccumulatorMs = 0;
    this.lastSentState = null;
    this.callbacks.onLobbyRestarted?.();
  }

  ensureRemotePlayer(id, state) {
    if (this.remotePlayers.has(id)) return;
    if (!this.playersGroup) return;

    const remote = new RemoteMoto(this.scene, id, this.spriteKey, state);
    this.remotePlayers.set(id, remote);
    this.playersGroup.add(remote.sprite);
  }

  syncPlayers(players = {}) {
    for (const [id, state] of Object.entries(players)) {
      if (!id || id === this.selfId) continue;
      this.ensureRemotePlayer(id, state);
      this.remotePlayers.get(id)?.applyServerState(state);
    }
  }

  emitStartGame(preferredSpawn) {
    if (!this.socket?.connected) return;
    this.socket.emit("startGame", { preferredSpawn });
  }

  emitFinishMatch() {
    if (!this.socket?.connected) return;
    this.socket.emit("finishMatch");
  }

  emitRestartLobby() {
    if (!this.socket?.connected) return;
    this.socket.emit("restartLobby");
  }

  emitLocalState() {
    if (!this.gameStarted) return;
    if (!this.socket?.connected || !this.selfId || !this.localSprite) return;

    const nextState = {
      x: Number(this.localSprite.x.toFixed(2)),
      y: Number(this.localSprite.y.toFixed(2)),
      angle: Number(this.localSprite.rotation.toFixed(4)),
    };

    const unchanged =
      this.lastSentState &&
      this.lastSentState.x === nextState.x &&
      this.lastSentState.y === nextState.y &&
      this.lastSentState.angle === nextState.angle;
    if (unchanged) return;

    this.lastSentState = nextState;
    this.socket.emit("updatePosition", nextState);
  }

  update(delta = 16.7) {
    for (const remote of this.remotePlayers.values()) {
      remote.update(delta);
    }

    this.sendAccumulatorMs += delta;
    if (this.sendAccumulatorMs < SEND_INTERVAL_MS) return;
    this.sendAccumulatorMs = 0;
    this.emitLocalState();
  }

  clearRemotePlayers() {
    for (const remote of this.remotePlayers.values()) {
      remote.destroy();
    }
    this.remotePlayers.clear();
  }

  destroy() {
    this.clearRemotePlayers();
    if (!this.socket) return;

    this.socket.off("initState", this.handleInitState);
    this.socket.off("lobbyState", this.handleLobbyState);
    this.socket.off("roomError", this.handleRoomError);
    this.socket.off("gameStarted", this.handleGameStarted);
    this.socket.off("playerMoved", this.handlePlayerMoved);
    this.socket.off("playerDisconnected", this.handlePlayerDisconnected);
    this.socket.off("matchFinished", this.handleMatchFinished);
    this.socket.off("lobbyRestarted", this.handleLobbyRestarted);
    this.socket.disconnect();
  }
}
