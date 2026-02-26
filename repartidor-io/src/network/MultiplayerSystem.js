import RemoteMoto from "./RemoteMoto.js";
import { createSocketConnection } from "./socketClient.js";

const SEND_INTERVAL_MS = 50;

export default class MultiplayerSystem {
  constructor(scene, options) {
    this.scene = scene;
    this.spriteKey = options.spriteKey;
    this.playersGroup = options.playersGroup;

    this.socket = null;
    this.selfId = null;
    this.localSprite = null;
    this.remotePlayers = new Map();
    this.sendAccumulatorMs = 0;
    this.lastSentState = null;

    this.handleInitState = this.handleInitState.bind(this);
    this.handlePlayerJoined = this.handlePlayerJoined.bind(this);
    this.handlePlayerMoved = this.handlePlayerMoved.bind(this);
    this.handlePlayerDisconnected = this.handlePlayerDisconnected.bind(this);
  }

  start(preferredSpawn, localSprite) {
    this.localSprite = localSprite;
    this.socket = createSocketConnection();

    this.socket.on("initState", this.handleInitState);
    this.socket.on("playerJoined", this.handlePlayerJoined);
    this.socket.on("playerMoved", this.handlePlayerMoved);
    this.socket.on("playerDisconnected", this.handlePlayerDisconnected);

    this.socket.on("connect", () => {
      this.socket.emit("registerPlayer", {
        preferredSpawn,
      });
    });
  }

  handleInitState(payload = {}) {
    this.selfId = payload.selfId;
    const players = payload.players || {};

    const selfState = players[this.selfId];
    if (selfState && this.localSprite) {
      this.localSprite.setPosition(selfState.x, selfState.y);
      this.localSprite.setRotation(selfState.angle || 0);
      this.localSprite.body?.updateFromGameObject();
    }

    for (const [id, state] of Object.entries(players)) {
      if (id === this.selfId) continue;
      this.ensureRemotePlayer(id, state);
    }
  }

  handlePlayerJoined(payload = {}) {
    const { id, state } = payload;
    if (!id || id === this.selfId || !state) return;
    this.ensureRemotePlayer(id, state);
  }

  handlePlayerMoved(payload = {}) {
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
  }

  ensureRemotePlayer(id, state) {
    if (this.remotePlayers.has(id)) return;

    const remote = new RemoteMoto(this.scene, id, this.spriteKey, state);
    this.remotePlayers.set(id, remote);
    this.playersGroup.add(remote.sprite);
  }

  emitLocalState() {
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

  destroy() {
    for (const remote of this.remotePlayers.values()) {
      remote.destroy();
    }
    this.remotePlayers.clear();

    if (!this.socket) return;
    this.socket.off("initState", this.handleInitState);
    this.socket.off("playerJoined", this.handlePlayerJoined);
    this.socket.off("playerMoved", this.handlePlayerMoved);
    this.socket.off("playerDisconnected", this.handlePlayerDisconnected);
    this.socket.disconnect();
  }
}
