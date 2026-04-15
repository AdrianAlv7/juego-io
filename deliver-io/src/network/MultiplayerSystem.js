import RemoteMoto from "./RemoteMoto.js";
import { createSocketConnection } from "./socketClient.js";

const SEND_INTERVAL_MS = 50;

export default class MultiplayerSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.spriteKey = options.spriteKey;
    this.playersGroup = options.playersGroup;
    this.callbacks = options.callbacks || {};
    this.getLocalProgress = options.getLocalProgress || null;
    this.getLocalHudSnapshot = options.getLocalHudSnapshot || null;

    this.socket = null;
    this.selfId = null;
    this.localSprite = null;
    this.gameStarted = false;
    this.roomInfo = null;
    this.remotePlayers = new Map();

    this.sendAccumulatorMs = 0;
    this.lastSentState = null;

    this.handleInitState = this.handleInitState.bind(this);
    this.handleLobbyState = this.handleLobbyState.bind(this);
    this.handleRoomError = this.handleRoomError.bind(this);
    this.handleConnectError = this.handleConnectError.bind(this);
    this.handleGameStarted = this.handleGameStarted.bind(this);
    this.handlePlayerMoved = this.handlePlayerMoved.bind(this);
    this.handlePlayerDisconnected = this.handlePlayerDisconnected.bind(this);
    this.handleRoomPlayerLeft = this.handleRoomPlayerLeft.bind(this);
    this.handleFinishWindowStarted = this.handleFinishWindowStarted.bind(this);
    this.handleMatchFinished = this.handleMatchFinished.bind(this);
    this.handleLobbyRestarted = this.handleLobbyRestarted.bind(this);
    this.handleWeatherEventQueued = this.handleWeatherEventQueued.bind(this);
    this.handleWeatherEventStarted = this.handleWeatherEventStarted.bind(this);
    this.handleWeatherEventEnded = this.handleWeatherEventEnded.bind(this);
    this.handleTrainEventStarted = this.handleTrainEventStarted.bind(this);
    this.handleTrainEventEnded = this.handleTrainEventEnded.bind(this);
    this.handleTrackItemsSnapshot = this.handleTrackItemsSnapshot.bind(this);
    this.handleTrackItemAdded = this.handleTrackItemAdded.bind(this);
    this.handleTrackItemUpdated = this.handleTrackItemUpdated.bind(this);
    this.handleTrackItemRemoved = this.handleTrackItemRemoved.bind(this);
    this.handleInventoryState = this.handleInventoryState.bind(this);
    this.handleEmpPulseStarted = this.handleEmpPulseStarted.bind(this);
    this.handleInventoryItemActivated =
      this.handleInventoryItemActivated.bind(this);
  }

  start(registerPayload = {}) {
    if (this.socket) {
      this.destroy();
    }

    this.socket = createSocketConnection();

    this.socket.on("initState", this.handleInitState);
    this.socket.on("lobbyState", this.handleLobbyState);
    this.socket.on("roomError", this.handleRoomError);
    this.socket.on("connect_error", this.handleConnectError);
    this.socket.on("gameStarted", this.handleGameStarted);
    this.socket.on("playerMoved", this.handlePlayerMoved);
    this.socket.on("playerDisconnected", this.handlePlayerDisconnected);
    this.socket.on("roomPlayerLeft", this.handleRoomPlayerLeft);
    this.socket.on("finishWindowStarted", this.handleFinishWindowStarted);
    this.socket.on("matchFinished", this.handleMatchFinished);
    this.socket.on("lobbyRestarted", this.handleLobbyRestarted);
    this.socket.on("weatherEventQueued", this.handleWeatherEventQueued);
    this.socket.on("weatherEventStarted", this.handleWeatherEventStarted);
    this.socket.on("weatherEventEnded", this.handleWeatherEventEnded);
    this.socket.on("trainEventStarted", this.handleTrainEventStarted);
    this.socket.on("trainEventEnded", this.handleTrainEventEnded);
    this.socket.on("trackItemsSnapshot", this.handleTrackItemsSnapshot);
    this.socket.on("trackItemAdded", this.handleTrackItemAdded);
    this.socket.on("trackItemUpdated", this.handleTrackItemUpdated);
    this.socket.on("trackItemRemoved", this.handleTrackItemRemoved);
    this.socket.on("inventoryState", this.handleInventoryState);
    this.socket.on("empPulseStarted", this.handleEmpPulseStarted);
    this.socket.on("inventoryItemActivated", this.handleInventoryItemActivated);

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
    this.roomInfo = payload.room || null;
    this.callbacks.onInit?.(payload);
  }

  handleLobbyState(payload = {}) {
    if (payload.roomId) {
      this.roomInfo = {
        roomId: payload.roomId,
        roomType: payload.roomType || "",
        roomCode: payload.roomCode || "",
        roomLabel: payload.roomLabel || "",
        maxPlayers: payload.maxPlayers || 6,
      };
    }
    this.callbacks.onLobbyState?.(payload);
  }

  handleRoomError(payload = {}) {
    this.callbacks.onRoomError?.(payload);
  }

  handleConnectError(error) {
    this.callbacks.onConnectError?.(error);
  }

  handleGameStarted(payload = {}) {
    if (payload.roomId) {
      this.roomInfo = {
        roomId: payload.roomId,
        roomType: payload.roomType || "",
        roomCode: payload.roomCode || "",
        roomLabel: payload.roomLabel || "",
        maxPlayers: payload.maxPlayers || 6,
      };
    }
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

  handleRoomPlayerLeft(payload = {}) {
    this.callbacks.onRoomPlayerLeft?.(payload);
  }

  handleFinishWindowStarted(payload = {}) {
    this.callbacks.onFinishWindowStarted?.(payload);
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

  getRoomInfo() {
    return this.roomInfo;
  }

  handleWeatherEventQueued(payload = {}) {
    this.callbacks.onWeatherEventQueued?.(payload);
  }

  handleWeatherEventStarted(payload = {}) {
    this.callbacks.onWeatherEventStarted?.(payload);
  }

  handleWeatherEventEnded(payload = {}) {
    this.callbacks.onWeatherEventEnded?.(payload);
  }

  handleTrainEventStarted(payload = {}) {
    this.callbacks.onTrainEventStarted?.(payload);
  }

  handleTrainEventEnded(payload = {}) {
    this.callbacks.onTrainEventEnded?.(payload);
  }

  handleTrackItemsSnapshot(payload = {}) {
    this.callbacks.onTrackItemsSnapshot?.(payload);
  }

  handleTrackItemAdded(payload = {}) {
    this.callbacks.onTrackItemAdded?.(payload);
  }

  handleTrackItemUpdated(payload = {}) {
    this.callbacks.onTrackItemUpdated?.(payload);
  }

  handleTrackItemRemoved(payload = {}) {
    this.callbacks.onTrackItemRemoved?.(payload);
  }

  handleInventoryState(payload = {}) {
    this.callbacks.onInventoryState?.(payload);
  }

  handleEmpPulseStarted(payload = {}) {
    this.callbacks.onEmpPulseStarted?.(payload);
  }

  handleInventoryItemActivated(payload = {}) {
    this.callbacks.onInventoryItemActivated?.(payload);
  }

  ensureRemotePlayer(id, state) {
    if (this.remotePlayers.has(id)) return;
    if (!this.playersGroup) return;

    const remote = new RemoteMoto(this.scene, id, state);
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

  getRemotePlayerStates() {
    return Array.from(this.remotePlayers.values(), (remote) => ({
      id: remote.id,
      x: remote.sprite.x,
      y: remote.sprite.y,
      angle: remote.sprite.rotation,
      motoId: remote.motoId,
    }));
  }

  getRemotePlayerSnapshot(id) {
    if (!id) return null;
    const remote = this.remotePlayers.get(id);
    if (!remote) return null;
    return remote.getSnapshot?.() || null;
  }

  getRemotePlayerSprite(id) {
    if (!id) return null;
    return this.remotePlayers.get(id)?.sprite || null;
  }

  getRemotePlayerSnapshots() {
    return Array.from(this.remotePlayers.values(), (remote) =>
      remote.getSnapshot?.()
    ).filter(Boolean);
  }

  emitStartGame(preferredSpawn) {
    if (!this.socket?.connected) return;
    this.socket.emit("startGame", { preferredSpawn });
  }

  emitCancelStartGame() {
    if (!this.socket?.connected) return;
    this.socket.emit("cancelStartGame");
  }

  emitSetLobbyReady(ready) {
    if (!this.socket?.connected) return;
    this.socket.emit("setLobbyReady", { ready });
  }

  emitSetGarageMoto(motoId) {
    if (!this.socket?.connected || !motoId) return;
    this.socket.emit("setGarageMoto", { motoId });
  }

  emitFinishMatch(payload = {}) {
    if (!this.socket?.connected) return;
    this.socket.emit("finishMatch", payload);
  }

  emitDebugSetFinishReport(payload = {}) {
    if (!this.socket?.connected) return;
    this.socket.emit("debugSetFinishReport", payload);
  }

  emitDebugFinalizeMatch() {
    if (!this.socket?.connected) return;
    this.socket.emit("debugFinalizeMatch");
  }

  emitRestartLobby() {
    if (!this.socket?.connected) return;
    this.socket.emit("restartLobby");
  }

  emitRequestLobbyReturn() {
    if (!this.socket?.connected) return;
    this.socket.emit("requestLobbyReturn");
  }

  emitQueueWeatherEvent(type) {
    if (!this.socket?.connected) return;
    this.socket.emit("queueWeatherEvent", { type });
  }

  emitClearWeatherEvent() {
    if (!this.socket?.connected) return;
    this.socket.emit("clearWeatherEvent");
  }

  emitStartTrainEvent(id = "") {
    if (!this.socket?.connected) return;
    this.socket.emit("startTrainEvent", { id });
  }

  emitGrantItem(type) {
    if (!this.socket?.connected) return;
    this.socket.emit("grantItem", { type });
  }

  emitDropItem() {
    if (!this.socket?.connected) return;
    this.socket.emit("dropItem");
  }

  emitTriggerTrackItem(id, type = "") {
    if (!this.socket?.connected || !id) return;
    this.socket.emit("triggerTrackItem", { id, type });
  }

  emitClaimRouteReward(rewardKey) {
    if (!this.socket?.connected || !rewardKey) return;
    this.socket.emit("claimRouteReward", { rewardKey });
  }

  emitLocalState() {
    if (!this.gameStarted) return;
    if (!this.socket?.connected || !this.selfId || !this.localSprite) return;

    const nextState = {
      x: Number(this.localSprite.x.toFixed(2)),
      y: Number(this.localSprite.y.toFixed(2)),
      angle: Number(this.localSprite.rotation.toFixed(4)),
    };
    const progress = this.getLocalProgress?.() || null;
    if (progress) {
      nextState.progress = progress;
    }
    const hud = this.getLocalHudSnapshot?.() || null;
    if (hud && typeof hud === "object") {
      nextState.hud = hud;
    }

    const unchanged =
      this.lastSentState &&
      this.lastSentState.x === nextState.x &&
      this.lastSentState.y === nextState.y &&
      this.lastSentState.angle === nextState.angle &&
      JSON.stringify(this.lastSentState.progress || null) ===
        JSON.stringify(nextState.progress || null) &&
      JSON.stringify(this.lastSentState.hud || null) ===
        JSON.stringify(nextState.hud || null);
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
    this.socket.off("connect_error", this.handleConnectError);
    this.socket.off("gameStarted", this.handleGameStarted);
    this.socket.off("playerMoved", this.handlePlayerMoved);
    this.socket.off("playerDisconnected", this.handlePlayerDisconnected);
    this.socket.off("roomPlayerLeft", this.handleRoomPlayerLeft);
    this.socket.off("finishWindowStarted", this.handleFinishWindowStarted);
    this.socket.off("matchFinished", this.handleMatchFinished);
    this.socket.off("lobbyRestarted", this.handleLobbyRestarted);
    this.socket.off("weatherEventQueued", this.handleWeatherEventQueued);
    this.socket.off("weatherEventStarted", this.handleWeatherEventStarted);
    this.socket.off("weatherEventEnded", this.handleWeatherEventEnded);
    this.socket.off("trainEventStarted", this.handleTrainEventStarted);
    this.socket.off("trainEventEnded", this.handleTrainEventEnded);
    this.socket.off("trackItemsSnapshot", this.handleTrackItemsSnapshot);
    this.socket.off("trackItemAdded", this.handleTrackItemAdded);
    this.socket.off("trackItemUpdated", this.handleTrackItemUpdated);
    this.socket.off("trackItemRemoved", this.handleTrackItemRemoved);
    this.socket.off("inventoryState", this.handleInventoryState);
    this.socket.off("empPulseStarted", this.handleEmpPulseStarted);
    this.socket.off("inventoryItemActivated", this.handleInventoryItemActivated);
    this.socket.disconnect();
    this.socket = null;
    this.selfId = null;
    this.localSprite = null;
    this.gameStarted = false;
    this.roomInfo = null;
    this.sendAccumulatorMs = 0;
    this.lastSentState = null;
  }
}
