function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function encodeGameSource(fileName) {
  return encodeURI(`/assets/sound/game/${fileName}`);
}

function decodeAudioBuffer(context, arrayBuffer) {
  if (!context || !arrayBuffer) {
    return Promise.resolve(null);
  }
  if (context.decodeAudioData.length >= 2) {
    return new Promise((resolve, reject) => {
      context.decodeAudioData(arrayBuffer, resolve, reject);
    });
  }
  return context.decodeAudioData(arrayBuffer);
}

function disconnectNode(node) {
  try {
    node?.disconnect?.();
  } catch (_error) {
    // Ignorado: algunos nodos ya pueden estar desconectados.
  }
}

const GAME_TRACKS = Object.freeze({
  start: encodeGameSource("start.ogg"),
  "drop1-1": encodeGameSource("drop1-1.ogg"),
  "drop1-2": encodeGameSource("drop1-2.ogg"),
  "drop1-3": encodeGameSource("drop1-3.ogg"),
  "drop1-4": encodeGameSource("drop1-4.ogg"),
  "drop1-final": encodeGameSource("drop1-final.ogg"),
  "drop1-semifinal": encodeGameSource("drop1-semifinal.ogg"),
  "antes-del-drop2": encodeGameSource("antes del drop2.ogg"),
  "drop2-1": encodeGameSource("drop2-1.ogg"),
  "drop2-2": encodeGameSource("drop2-2.ogg"),
  "drop2-3": encodeGameSource("drop2-3.ogg"),
  "drop2-4": encodeGameSource("drop2-4.ogg"),
  "antes-del-drop3": encodeGameSource("antes del drop3.ogg"),
  "loop-antes-del-drop3": encodeGameSource("loop antes del drop 3.ogg"),
  "inicio-drop3": encodeGameSource("inicio drop 3.ogg"),
  "drop3-1": encodeGameSource("drop3-1.ogg"),
  "drop3-2": encodeGameSource("drop3-2.ogg"),
  "drop3-3": encodeGameSource("drop3-3.ogg"),
  "drop3-4": encodeGameSource("drop3-4.ogg"),
  final: encodeGameSource("final.ogg"),
  chill1: encodeGameSource("chill1.ogg"),
  chill2: encodeGameSource("chill2.ogg"),
});

const DROP1_LOOP = Object.freeze(["drop1-1", "drop1-2", "drop1-3", "drop1-4"]);
const DROP2_LOOP = Object.freeze(["drop2-1", "drop2-2", "drop2-3", "drop2-4"]);
const DROP3_LOOP = Object.freeze(["drop3-1", "drop3-2", "drop3-3", "drop3-4"]);

function isDrop1EarlyLoop(label) {
  return label === "drop1-1" || label === "drop1-2";
}

export default class GameMusicController {
  // Guia rapida para retocar la musica de partida:
  // - trackGain: balance interno contra el master general.
  // - decodeLeadMs: cuanto antes dejamos decodificada la siguiente pista.
  // - scheduleLeadMs: margen para programar el siguiente clip sin dejar hueco.
  // - stopFadeOutMs: fade suave al salir de sala o volver al lobby.
  // - visibilityFadeOutMs / visibilityFadeInMs: reaccion al perder o recuperar foco.
  // - computeNextTrack(): flujo musical real, loops y rupturas por objetivos.
  constructor(options = {}) {
    this.masterVolume = clamp01(options.masterVolume ?? 0.100);
    // Este gain usa el mismo slider global de musica del manager.
    // Solo define el peso interno de las pistas de carrera para igualarlas con lobby.
    this.trackGain = clamp01(options.trackGain ?? 0.50);
    this.decodeLeadMs = Math.max(250, Number(options.decodeLeadMs ?? 2200)); 
    this.scheduleLeadMs = Math.max(25, Number(options.scheduleLeadMs ?? 140));
    this.stopFadeOutMs = Math.max(0, Number(options.stopFadeOutMs ?? 260));
    this.visibilityFadeOutMs = Math.max(0, Number(options.visibilityFadeOutMs ?? 180));
    this.visibilityFadeInMs = Math.max(0, Number(options.visibilityFadeInMs ?? 220));
    this.onTrackLabelChange =
      typeof options.onTrackLabelChange === "function" ? options.onTrackLabelChange : null;

    this.audioContext = null;
    this.masterGainNode = null;
    this.bufferCache = new Map();
    this.bufferWarmupStarted = false;
    this.monitorTimerId = 0;
    this.playbackIdCounter = 0;

    this.shouldPlay = false;
    this.awaitingUnlock = false;
    this.suspendedForInactivity = false;
    this.sessionId = 0;
    this.currentTrackLabel = "";
    this.currentTrackSource = "";
    this.currentPlayback = null;
    this.queuedPlayback = null;
    this.resumeState = null;

    this.resetSequenceState();
    this.emitTrackLabelChange();
  }

  getAudioContext() {
    if (this.audioContext && this.audioContext.state !== "closed") {
      return this.audioContext;
    }
    if (typeof window === "undefined") return null;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;

    this.audioContext = new AudioContextCtor();
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
    this.applyMasterGain();
    return this.audioContext;
  }

  applyMasterGain() {
    const context = this.audioContext;
    if (!context || !this.masterGainNode) return;
    this.masterGainNode.gain.setValueAtTime(
      clamp01(this.masterVolume * this.trackGain),
      context.currentTime
    );
  }

  ensureContextRunning() {
    const context = this.getAudioContext();
    if (!context) return;
    if (context.state === "running") {
      this.awaitingUnlock = false;
      return;
    }
    context.resume().then(
      () => {
        this.awaitingUnlock = false;
      },
      () => {
        this.awaitingUnlock = true;
      }
    );
  }

  loadBuffer(label) {
    const source = GAME_TRACKS[label];
    if (!source) {
      return Promise.resolve(null);
    }
    if (this.bufferCache.has(label)) {
      return this.bufferCache.get(label);
    }

    const task = (async () => {
      const context = this.getAudioContext();
      if (!context) return null;

      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${source}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return decodeAudioBuffer(context, arrayBuffer);
    })().catch((error) => {
      this.bufferCache.delete(label);
      throw error;
    });

    this.bufferCache.set(label, task);
    return task;
  }

  warmAllBuffers() {
    if (this.bufferWarmupStarted) return;
    this.bufferWarmupStarted = true;
    Object.keys(GAME_TRACKS).forEach((label) => {
      this.loadBuffer(label).catch(() => {
        // Si una pista falla, la volveremos a intentar cuando realmente se necesite.
      });
    });
  }

  // Esto ayuda al manager global a decidir si debe esperar un fade antes
  // de cambiar entre musica de lobby y musica de partida.
  isSessionActive() {
    return Boolean(this.shouldPlay || this.currentPlayback || this.queuedPlayback);
  }

  resetSequenceState() {
    this.phase = "idle";
    this.drop1LoopIndex = -1;
    this.drop2LoopIndex = -1;
    this.drop3LoopIndex = -1;
    this.pendingDrop1Closure = false;
    this.pendingDrop2Closure = false;
    this.hasPickedOrder3 = false;
    this.hasReachedFinish = false;
  }

  getSequenceSnapshot() {
    return {
      phase: this.phase,
      drop1LoopIndex: this.drop1LoopIndex,
      drop2LoopIndex: this.drop2LoopIndex,
      drop3LoopIndex: this.drop3LoopIndex,
      pendingDrop1Closure: this.pendingDrop1Closure,
      pendingDrop2Closure: this.pendingDrop2Closure,
      hasPickedOrder3: this.hasPickedOrder3,
      hasReachedFinish: this.hasReachedFinish,
    };
  }

  applySequenceSnapshot(snapshot = {}) {
    this.phase = String(snapshot.phase || "idle");
    this.drop1LoopIndex = Number(snapshot.drop1LoopIndex ?? -1);
    this.drop2LoopIndex = Number(snapshot.drop2LoopIndex ?? -1);
    this.drop3LoopIndex = Number(snapshot.drop3LoopIndex ?? -1);
    this.pendingDrop1Closure = Boolean(snapshot.pendingDrop1Closure);
    this.pendingDrop2Closure = Boolean(snapshot.pendingDrop2Closure);
    this.hasPickedOrder3 = Boolean(snapshot.hasPickedOrder3);
    this.hasReachedFinish = Boolean(snapshot.hasReachedFinish);
  }

  emitTrackLabelChange() {
    this.onTrackLabelChange?.(
      this.currentTrackLabel ? `Partida: ${this.currentTrackLabel}` : "Partida: silencio"
    );
  }

  setCurrentTrack(label) {
    this.currentTrackLabel = String(label || "");
    this.currentTrackSource = this.currentTrackLabel
      ? GAME_TRACKS[this.currentTrackLabel] || ""
      : "";
    this.emitTrackLabelChange();
  }

  setMasterVolume(volume) {
    this.masterVolume = clamp01(volume);
    this.applyMasterGain();
  }

  clearMonitor() {
    if (!this.monitorTimerId) return;
    window.clearInterval(this.monitorTimerId);
    this.monitorTimerId = 0;
  }

  ensureMonitor(sessionId) {
    this.clearMonitor();
    this.monitorTimerId = window.setInterval(() => {
      this.monitorPlayback(sessionId);
    }, 50);
  }

  monitorPlayback(sessionId) {
    if (sessionId !== this.sessionId || !this.shouldPlay || this.suspendedForInactivity) {
      this.clearMonitor();
      return;
    }

    const context = this.getAudioContext();
    const current = this.currentPlayback;
    if (!context || !current) return;

    if (this.queuedPlayback && context.currentTime >= this.queuedPlayback.startTime - 0.02) {
      this.promoteQueuedPlayback();
      return;
    }

    const remainingMs = Math.max(0, (current.endTime - context.currentTime) * 1000);
    const nextLabel = this.peekNextTrackLabel(current.label);
    if (!nextLabel) return;

    if (remainingMs <= this.decodeLeadMs) {
      this.loadBuffer(nextLabel).catch(() => {
        // Si falla el decode temprano, se volvera a intentar justo antes del cambio.
      });
    }

    const shouldScheduleNow =
      remainingMs <= this.scheduleLeadMs || Boolean(this.queuedPlayback);
    if (shouldScheduleNow) {
      this.scheduleUpcomingTrack(true);
    }
  }

  createPlayback(label, buffer, startTime, offsetSec = 0, nextStateSnapshot = null) {
    const context = this.getAudioContext();
    if (!context || !this.masterGainNode || !buffer) return null;

    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();

    sourceNode.buffer = buffer;
    sourceNode.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    const playback = {
      id: (this.playbackIdCounter += 1),
      label,
      buffer,
      sourceNode,
      gainNode,
      startTime,
      offsetSec,
      endTime: startTime + Math.max(0, buffer.duration - offsetSec),
      nextStateSnapshot,
      cleanedUp: false,
    };

    sourceNode.onended = () => {
      this.handlePlaybackEnded(playback);
    };

    sourceNode.start(startTime, offsetSec);
    return playback;
  }

  cleanupPlayback(playback) {
    if (!playback || playback.cleanedUp) return;
    playback.cleanedUp = true;
    disconnectNode(playback.sourceNode);
    disconnectNode(playback.gainNode);
  }

  stopPlaybackImmediately(playback) {
    if (!playback) return;
    try {
      playback.sourceNode.stop();
    } catch (_error) {
      // Ignorado: el nodo ya puede estar detenido.
    }
    this.cleanupPlayback(playback);
  }

  cancelQueuedPlayback() {
    if (!this.queuedPlayback) return;
    this.stopPlaybackImmediately(this.queuedPlayback);
    this.queuedPlayback = null;
  }

  getCurrentPlaybackOffset(playback = this.currentPlayback) {
    const context = this.getAudioContext();
    if (!context || !playback?.buffer) return 0;
    const elapsedSec = Math.max(0, context.currentTime - playback.startTime);
    return Math.max(
      0,
      Math.min(playback.buffer.duration, playback.offsetSec + elapsedSec)
    );
  }

  computeNextTrack(snapshot = {}, endedLabel = "") {
    const nextState = {
      phase: String(snapshot.phase || "idle"),
      drop1LoopIndex: Number(snapshot.drop1LoopIndex ?? -1),
      drop2LoopIndex: Number(snapshot.drop2LoopIndex ?? -1),
      drop3LoopIndex: Number(snapshot.drop3LoopIndex ?? -1),
      pendingDrop1Closure: Boolean(snapshot.pendingDrop1Closure),
      pendingDrop2Closure: Boolean(snapshot.pendingDrop2Closure),
      hasPickedOrder3: Boolean(snapshot.hasPickedOrder3),
      hasReachedFinish: Boolean(snapshot.hasReachedFinish),
    };

    switch (nextState.phase) {
      case "start":
        nextState.phase = "drop1-loop";
        nextState.drop1LoopIndex = 0;
        return { nextLabel: DROP1_LOOP[nextState.drop1LoopIndex], nextState };
      case "drop1-loop":
        if (nextState.pendingDrop1Closure) {
          nextState.phase = "drop1-close";
          nextState.pendingDrop1Closure = false;
          return {
            nextLabel: isDrop1EarlyLoop(endedLabel) ? "drop1-semifinal" : "drop1-final",
            nextState,
          };
        }
        nextState.drop1LoopIndex = (nextState.drop1LoopIndex + 1) % DROP1_LOOP.length;
        return { nextLabel: DROP1_LOOP[nextState.drop1LoopIndex], nextState };
      case "drop1-close":
        nextState.phase = "before-drop2";
        return { nextLabel: "antes-del-drop2", nextState };
      case "before-drop2":
        nextState.phase = "drop2-loop";
        nextState.drop2LoopIndex = 0;
        return { nextLabel: DROP2_LOOP[nextState.drop2LoopIndex], nextState };
      case "drop2-loop":
        if (nextState.pendingDrop2Closure) {
          nextState.phase = "before-drop3";
          nextState.pendingDrop2Closure = false;
          return { nextLabel: "antes-del-drop3", nextState };
        }
        nextState.drop2LoopIndex = (nextState.drop2LoopIndex + 1) % DROP2_LOOP.length;
        return { nextLabel: DROP2_LOOP[nextState.drop2LoopIndex], nextState };
      case "before-drop3":
        if (nextState.hasPickedOrder3) {
          nextState.phase = "drop3-intro";
          return { nextLabel: "inicio-drop3", nextState };
        }
        nextState.phase = "before-drop3-loop";
        return { nextLabel: "loop-antes-del-drop3", nextState };
      case "before-drop3-loop":
        if (nextState.hasPickedOrder3) {
          nextState.phase = "drop3-intro";
          return { nextLabel: "inicio-drop3", nextState };
        }
        return { nextLabel: "loop-antes-del-drop3", nextState };
      case "drop3-intro":
        nextState.phase = "drop3-loop";
        nextState.drop3LoopIndex = 0;
        return { nextLabel: DROP3_LOOP[nextState.drop3LoopIndex], nextState };
      case "drop3-loop":
        if (nextState.hasReachedFinish) {
          nextState.phase = "final";
          return { nextLabel: "final", nextState };
        }
        nextState.drop3LoopIndex = (nextState.drop3LoopIndex + 1) % DROP3_LOOP.length;
        return { nextLabel: DROP3_LOOP[nextState.drop3LoopIndex], nextState };
      case "final":
        nextState.phase = "chill-intro";
        return { nextLabel: "chill1", nextState };
      case "chill-intro":
        nextState.phase = "chill-loop";
        return { nextLabel: "chill2", nextState };
      case "chill-loop":
        return { nextLabel: "chill2", nextState };
      default:
        return { nextLabel: "", nextState };
    }
  }

  peekNextTrackLabel(endedLabel) {
    return this.computeNextTrack(this.getSequenceSnapshot(), endedLabel).nextLabel;
  }

  commitNextTrackLabel(endedLabel) {
    const { nextLabel, nextState } = this.computeNextTrack(
      this.getSequenceSnapshot(),
      endedLabel
    );
    this.applySequenceSnapshot(nextState);
    return nextLabel;
  }

  startTrackNow(label, options = {}) {
    const sessionId = this.sessionId;
    const fadeInMs = Math.max(0, Number(options.fadeInMs ?? 0));
    const offsetSec = Math.max(0, Number(options.offsetSec ?? 0));

    this.ensureContextRunning();

    return this.loadBuffer(label)
      .then((buffer) => {
        const context = this.getAudioContext();
        if (
          !context ||
          !buffer ||
          sessionId !== this.sessionId ||
          !this.shouldPlay ||
          this.suspendedForInactivity
        ) {
          return false;
        }

        const startTime = context.currentTime + 0.012;
        const playback = this.createPlayback(label, buffer, startTime, offsetSec);
        if (!playback) {
          return false;
        }

        const previousPlayback = this.currentPlayback;
        this.cancelQueuedPlayback();
        this.currentPlayback = playback;
        this.resumeState = null;
        this.setCurrentTrack(label);

        playback.gainNode.gain.cancelScheduledValues(startTime);
        playback.gainNode.gain.setValueAtTime(0, startTime);
        if (fadeInMs > 0) {
          playback.gainNode.gain.linearRampToValueAtTime(1, startTime + fadeInMs / 1000);
        } else {
          playback.gainNode.gain.setValueAtTime(1, startTime);
        }

        this.ensureMonitor(sessionId);
        this.scheduleUpcomingTrack(false);

        if (previousPlayback) {
          this.stopPlaybackImmediately(previousPlayback);
        }
        return true;
      })
      .catch(() => false);
  }

  scheduleUpcomingTrack(forceReschedule = false) {
    const sessionId = this.sessionId;
    const context = this.getAudioContext();
    const current = this.currentPlayback;

    if (!context || !current || !this.shouldPlay || this.suspendedForInactivity) {
      return false;
    }

    const remainingMs = Math.max(0, (current.endTime - context.currentTime) * 1000);
    const nextPlan = this.computeNextTrack(this.getSequenceSnapshot(), current.label);
    const nextLabel = nextPlan.nextLabel;

    if (!nextLabel) {
      this.cancelQueuedPlayback();
      return false;
    }

    if (remainingMs <= this.decodeLeadMs) {
      this.loadBuffer(nextLabel).catch(() => {
        // Se reintentara si el cambio aun no llego.
      });
    }

    if (!forceReschedule && remainingMs > this.scheduleLeadMs) {
      return false;
    }

    const queueAlreadyMatches =
      this.queuedPlayback &&
      this.queuedPlayback.label === nextLabel &&
      this.queuedPlayback.startTime === current.endTime;
    if (queueAlreadyMatches) {
      return true;
    }

    this.loadBuffer(nextLabel)
      .then((buffer) => {
        const liveContext = this.getAudioContext();
        const liveCurrent = this.currentPlayback;
        if (
          !liveContext ||
          !buffer ||
          sessionId !== this.sessionId ||
          !this.shouldPlay ||
          this.suspendedForInactivity ||
          !liveCurrent ||
          liveCurrent.id !== current.id
        ) {
          return;
        }

        const livePlan = this.computeNextTrack(this.getSequenceSnapshot(), liveCurrent.label);
        if (livePlan.nextLabel !== nextLabel) {
          this.scheduleUpcomingTrack(true);
          return;
        }

        if (this.queuedPlayback) {
          this.cancelQueuedPlayback();
        }

        const queuedPlayback = this.createPlayback(
          nextLabel,
          buffer,
          liveCurrent.endTime,
          0,
          livePlan.nextState
        );
        if (!queuedPlayback) return;
        queuedPlayback.gainNode.gain.setValueAtTime(1, queuedPlayback.startTime);
        this.queuedPlayback = queuedPlayback;
      })
      .catch(() => {
        // Si falla justo aqui, dejaremos que el ended haga fallback.
      });

    return true;
  }

  promoteQueuedPlayback() {
    const context = this.getAudioContext();
    if (!context || !this.queuedPlayback) return false;
    if (context.currentTime < this.queuedPlayback.startTime - 0.02) return false;

    const nextPlayback = this.queuedPlayback;
    this.queuedPlayback = null;
    this.currentPlayback = nextPlayback;
    if (nextPlayback.nextStateSnapshot) {
      this.applySequenceSnapshot(nextPlayback.nextStateSnapshot);
    }
    this.setCurrentTrack(nextPlayback.label);
    this.ensureMonitor(this.sessionId);
    this.scheduleUpcomingTrack(false);
    return true;
  }

  handlePlaybackEnded(playback) {
    this.cleanupPlayback(playback);

    if (!this.shouldPlay) {
      if (this.currentPlayback?.id === playback.id) {
        this.currentPlayback = null;
        this.setCurrentTrack("");
      }
      return;
    }

    if (this.currentPlayback?.id !== playback.id) {
      if (this.queuedPlayback?.id === playback.id) {
        this.queuedPlayback = null;
      }
      return;
    }

    if (this.promoteQueuedPlayback()) {
      return;
    }

    const nextLabel = this.commitNextTrackLabel(playback.label);
    this.currentPlayback = null;
    if (!nextLabel) {
      this.stop({ fadeOutMs: 0 });
      return;
    }
    this.startTrackNow(nextLabel);
  }

  startMatch() {
    this.sessionId += 1;
    this.shouldPlay = true;
    this.awaitingUnlock = false;
    this.suspendedForInactivity = false;
    this.resumeState = null;
    this.resetSequenceState();
    this.phase = "start";
    this.clearMonitor();
    this.cancelQueuedPlayback();
    if (this.currentPlayback) {
      this.stopPlaybackImmediately(this.currentPlayback);
      this.currentPlayback = null;
    }
    this.setCurrentTrack("");
    this.ensureContextRunning();
    this.warmAllBuffers();
    this.startTrackNow("start");
  }

  handleObjectiveCompleted(completed = {}) {
    const kind = String(completed.kind || "");
    const orderNumber = Number(completed.orderNumber || 0);

    if (kind === "dropoff" && orderNumber === 1) {
      this.pendingDrop1Closure = true;
    } else if (kind === "dropoff" && orderNumber === 2) {
      this.pendingDrop2Closure = true;
    } else if (kind === "pickup" && orderNumber === 3) {
      this.hasPickedOrder3 = true;
    }

    if (this.currentPlayback) {
      this.scheduleUpcomingTrack(Boolean(this.queuedPlayback));
    }
  }

  handleLocalFinish() {
    this.hasReachedFinish = true;
    if (this.currentPlayback) {
      this.scheduleUpcomingTrack(Boolean(this.queuedPlayback));
    }
  }

  ensurePlayback() {
    if (!this.shouldPlay) return;
    if (this.suspendedForInactivity && this.resumePlayback()) {
      return;
    }
    this.ensureContextRunning();
  }

  suspendPlayback(options = {}) {
    const context = this.getAudioContext();
    const current = this.currentPlayback;
    if (
      !context ||
      !this.shouldPlay ||
      this.suspendedForInactivity ||
      !current
    ) {
      return false;
    }

    const fadeOutMs = Math.max(0, Number(options.fadeOutMs ?? this.visibilityFadeOutMs));
    const sessionId = this.sessionId + 1;
    const resumeOffsetSec = this.getCurrentPlaybackOffset(current);
    this.sessionId = sessionId;
    this.suspendedForInactivity = true;
    this.resumeState = {
      label: current.label,
      offsetSec: resumeOffsetSec,
      stateSnapshot: this.getSequenceSnapshot(),
    };
    this.clearMonitor();
    this.cancelQueuedPlayback();

    const finalizePause = () => {
      if (sessionId !== this.sessionId || !this.suspendedForInactivity) return;
      if (this.currentPlayback?.id === current.id) {
        this.stopPlaybackImmediately(current);
        this.currentPlayback = null;
      }
    };

    current.gainNode.gain.cancelScheduledValues(context.currentTime);
    current.gainNode.gain.setValueAtTime(current.gainNode.gain.value, context.currentTime);
    current.gainNode.gain.linearRampToValueAtTime(
      0,
      context.currentTime + fadeOutMs / 1000
    );
    window.setTimeout(finalizePause, fadeOutMs + 48);
    return true;
  }

  resumePlayback(options = {}) {
    if (!this.shouldPlay || !this.suspendedForInactivity || !this.resumeState) {
      return false;
    }

    const fadeInMs = Math.max(0, Number(options.fadeInMs ?? this.visibilityFadeInMs));
    const resumeState = this.resumeState;
    this.sessionId += 1;
    this.suspendedForInactivity = false;
    this.applySequenceSnapshot(resumeState.stateSnapshot);
    this.startTrackNow(resumeState.label, {
      offsetSec: resumeState.offsetSec,
      fadeInMs,
    });
    return true;
  }

  stop(options = {}) {
    const context = this.getAudioContext();
    const fadeOutMs = Math.max(0, Number(options.fadeOutMs ?? this.stopFadeOutMs));
    const sessionId = this.sessionId + 1;
    const current = this.currentPlayback;

    this.sessionId = sessionId;
    this.shouldPlay = false;
    this.awaitingUnlock = false;
    this.suspendedForInactivity = false;
    this.resumeState = null;
    this.resetSequenceState();
    this.clearMonitor();
    this.cancelQueuedPlayback();

    if (!context || !current) {
      this.currentPlayback = null;
      this.setCurrentTrack("");
      return;
    }

    const finalizeStop = () => {
      if (sessionId !== this.sessionId) return;
      if (this.currentPlayback?.id === current.id) {
        this.stopPlaybackImmediately(current);
        this.currentPlayback = null;
      }
      this.setCurrentTrack("");
    };

    if (fadeOutMs <= 0) {
      finalizeStop();
      return;
    }

    current.gainNode.gain.cancelScheduledValues(context.currentTime);
    current.gainNode.gain.setValueAtTime(current.gainNode.gain.value, context.currentTime);
    current.gainNode.gain.linearRampToValueAtTime(
      0,
      context.currentTime + fadeOutMs / 1000
    );
    window.setTimeout(finalizeStop, fadeOutMs + 48);
  }

  destroy() {
    this.stop({ fadeOutMs: 0 });
    this.clearMonitor();
    this.cancelQueuedPlayback();
    if (this.currentPlayback) {
      this.stopPlaybackImmediately(this.currentPlayback);
      this.currentPlayback = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {
        // Ignorado al destruir.
      });
    }
    this.audioContext = null;
    this.masterGainNode = null;
    this.bufferCache.clear();
  }
}
