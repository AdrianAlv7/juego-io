function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function encodeLobbySource(fileName) {
  return encodeURI(`/assets/sound/lobby/${fileName}`);
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

function pickRandom(items) {
  if (!Array.isArray(items) || !items.length) return "";
  return items[Math.floor(Math.random() * items.length)] || "";
}

function clonePlan(plan) {
  return Array.isArray(plan) ? plan.filter(Boolean).map((label) => String(label)) : [];
}

function buildInsanoPatternKey(pattern) {
  return Array.isArray(pattern) ? pattern.join(" > ") : "";
}

function normalizeLobbyLabel(label) {
  const normalized = String(label || "").trim();
  if (!normalized) return "";

  if (LOBBY_TRACKS[normalized]) {
    return normalized;
  }

  return LOBBY_PREVIEW_ALIASES[normalized] || "";
}

function chooseWeightedOption(items, previousKey = "") {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!normalizedItems.length) return null;

  const filteredItems = normalizedItems.filter((item) => item.key !== previousKey);
  const sourceItems = filteredItems.length ? filteredItems : normalizedItems;
  const totalWeight = sourceItems.reduce(
    (total, item) => total + Math.max(1, Number(item.weight || 1)),
    0
  );
  let remainingWeight = Math.random() * totalWeight;

  for (const item of sourceItems) {
    remainingWeight -= Math.max(1, Number(item.weight || 1));
    if (remainingWeight <= 0) {
      return item;
    }
  }

  return sourceItems[sourceItems.length - 1] || null;
}

const LOBBY_TRACKS = Object.freeze({
  intro: encodeLobbySource("intro.ogg"),
  "drop1-1": encodeLobbySource("drop1-1.ogg"),
  "drop1-2": encodeLobbySource("drop1-2.ogg"),
  "drop1-3": encodeLobbySource("drop1-3.ogg"),
  "drop1-4": encodeLobbySource("drop1-4.ogg"),
  "drop1-5 moto": encodeLobbySource("drop1-5 moto.ogg"),
  "drop1-6 moto": encodeLobbySource("drop1-6 moto.ogg"),
  "drop1-end": encodeLobbySource("drop1-end.ogg"),
  "antes dropinsano": encodeLobbySource("antes dropinsano.ogg"),
  intermedio: encodeLobbySource("intermedio.ogg"),
  "dropinsano1-1": encodeLobbySource("dropinsano1-1.ogg"),
  "dropinsano1-2": encodeLobbySource("dropinsano1-2.ogg"),
  "dropinsano1-end": encodeLobbySource("dropinsano1-end.ogg"),
  end: encodeLobbySource("end.ogg"),
});

const LOBBY_PREVIEW_ALIASES = Object.freeze({
  start: "intro",
  drop1: "drop1-1",
  drop2: "drop1-4",
  dropInsano: "dropinsano1-1",
});

const DROP1_ENTRY_LABELS = Object.freeze(["drop1-1", "drop1-2"]);
const DROP1_LIGAMENTS = Object.freeze({
  "drop1-1": "drop1-4",
  "drop1-2": "drop1-3",
});
const DROP1_MOTO_LABELS = Object.freeze(["drop1-5 moto", "drop1-6 moto"]);
const INSANO_PATTERNS = Object.freeze([
  Object.freeze(["dropinsano1-1"]),
  Object.freeze(["dropinsano1-2"]),
  Object.freeze(["dropinsano1-1", "dropinsano1-2"]),
]);
const DROP1_BLOCK_OPTIONS = Object.freeze([
  Object.freeze({ key: "entry-end", weight: 14 }),
  Object.freeze({ key: "entry-partner-end", weight: 24 }),
  Object.freeze({ key: "entry-moto-end", weight: 25 }),
  Object.freeze({ key: "entry-partner-moto-end", weight: 37 }),
]);

export default class LobbyMusicController {
  // Guia rapida para retocar la musica del lobby:
  // - trackGain: balance interno del lobby contra el slider global de musica.
  // - decodeLeadMs / scheduleLeadMs: cuanto antes dejamos lista la siguiente pista.
  // - stopFadeOutMs: salida suave al cambiar a partida o cortar el lobby.
  // - visibilityFadeOutMs / visibilityFadeInMs: reaccion al perder y recuperar foco.
  // - buildCyclePlan(): aqui viven las reglas de combinacion entre intro, drop1, insano y end.
  // - pickDrop1BlockOption() / pickInsanoPattern(): ajusta variedad sin romper ligamentos.
  constructor(options = {}) {
    this.masterVolume = clamp01(options.masterVolume ?? 0.75);
    // Lobby y game comparten el mismo slider general; este gain solo empareja su pegada interna.
    this.trackGain = clamp01(options.trackGain ?? 0.5);
    this.decodeLeadMs = Math.max(250, Number(options.decodeLeadMs ?? 2200));
    this.scheduleLeadMs = Math.max(25, Number(options.scheduleLeadMs ?? 140));
    this.stopFadeOutMs = Math.max(0, Number(options.stopFadeOutMs ?? 260));
    this.visibilityFadeOutMs = Math.max(0, Number(options.visibilityFadeOutMs ?? 180));
    this.visibilityFadeInMs = Math.max(0, Number(options.visibilityFadeInMs ?? 220));
    this.onTrackLabelChange =
      typeof options.onTrackLabelChange === "function" ? options.onTrackLabelChange : null;
    this.onTrackStateChange =
      typeof options.onTrackStateChange === "function" ? options.onTrackStateChange : null;

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
    this.previewMode = false;
    this.previewTrackLabel = "";

    this.resetSequenceState();
    this.emitTrackStateChange();
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
    const normalizedLabel = normalizeLobbyLabel(label);
    const source = LOBBY_TRACKS[normalizedLabel];
    if (!source) {
      return Promise.resolve(null);
    }
    if (this.bufferCache.has(normalizedLabel)) {
      return this.bufferCache.get(normalizedLabel);
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
      this.bufferCache.delete(normalizedLabel);
      throw error;
    });

    this.bufferCache.set(normalizedLabel, task);
    return task;
  }

  warmAllBuffers() {
    if (this.bufferWarmupStarted) return;
    this.bufferWarmupStarted = true;
    Object.keys(LOBBY_TRACKS).forEach((label) => {
      this.loadBuffer(label).catch(() => {
        // Si una pista falla, la reintentaremos justo cuando haga falta.
      });
    });
  }

  isSessionActive() {
    return Boolean(this.shouldPlay || this.currentPlayback || this.queuedPlayback);
  }

  resetSequenceState() {
    this.currentCyclePlan = [];
    this.currentCycleIndex = -1;
    this.completedCycleCount = 0;
    this.lastCycleEntryLabel = "";
    this.lastMotoLabel = "";
    this.lastPostDropChoice = "";
    this.lastInsanoPatternKey = "";
    this.lastDropBlockKey = "";
  }

  getSequenceSnapshot() {
    return {
      currentCyclePlan: clonePlan(this.currentCyclePlan),
      currentCycleIndex: Number(this.currentCycleIndex ?? -1),
      completedCycleCount: Number(this.completedCycleCount ?? 0),
      lastCycleEntryLabel: String(this.lastCycleEntryLabel || ""),
      lastMotoLabel: String(this.lastMotoLabel || ""),
      lastPostDropChoice: String(this.lastPostDropChoice || ""),
      lastInsanoPatternKey: String(this.lastInsanoPatternKey || ""),
      lastDropBlockKey: String(this.lastDropBlockKey || ""),
    };
  }

  applySequenceSnapshot(snapshot = {}) {
    this.currentCyclePlan = clonePlan(snapshot.currentCyclePlan);
    this.currentCycleIndex = Number(snapshot.currentCycleIndex ?? -1);
    this.completedCycleCount = Number(snapshot.completedCycleCount ?? 0);
    this.lastCycleEntryLabel = String(snapshot.lastCycleEntryLabel || "");
    this.lastMotoLabel = String(snapshot.lastMotoLabel || "");
    this.lastPostDropChoice = String(snapshot.lastPostDropChoice || "");
    this.lastInsanoPatternKey = String(snapshot.lastInsanoPatternKey || "");
    this.lastDropBlockKey = String(snapshot.lastDropBlockKey || "");
  }

  emitTrackLabelChange() {
    this.onTrackLabelChange?.(
      this.currentTrackLabel ? `Musica: ${this.currentTrackLabel}` : "Musica: silencio"
    );
  }

  emitTrackStateChange() {
    this.onTrackStateChange?.({
      primaryLabel: this.currentTrackLabel,
      overlayLabel: "",
      primarySource: this.currentTrackSource,
      overlaySource: "",
    });
  }

  setCurrentTrack(label) {
    this.currentTrackLabel = normalizeLobbyLabel(label);
    this.currentTrackSource = this.currentTrackLabel
      ? LOBBY_TRACKS[this.currentTrackLabel] || ""
      : "";
    this.emitTrackStateChange();
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

  pickNextDropEntry(previousEntryLabel = "") {
    if (previousEntryLabel === "drop1-1") return "drop1-2";
    if (previousEntryLabel === "drop1-2") return "drop1-1";
    return pickRandom(DROP1_ENTRY_LABELS) || DROP1_ENTRY_LABELS[0];
  }

  pickDrop1BlockOption(previousKey = "") {
    return (
      chooseWeightedOption(DROP1_BLOCK_OPTIONS, previousKey) || DROP1_BLOCK_OPTIONS[0]
    );
  }

  pickMotoAccent(previousMotoLabel = "") {
    const filteredLabels = DROP1_MOTO_LABELS.filter((label) => label !== previousMotoLabel);
    return pickRandom(filteredLabels.length ? filteredLabels : DROP1_MOTO_LABELS);
  }

  shouldUseIntermedio(snapshot = {}) {
    if (Number(snapshot.completedCycleCount || 0) <= 0) {
      return true;
    }
    const intermedioChance =
      String(snapshot.lastPostDropChoice || "") === "intermedio" ? 0.32 : 0.56;
    return Math.random() < intermedioChance;
  }

  pickInsanoPattern(previousPatternKey = "") {
    const candidatePatterns = INSANO_PATTERNS.filter(
      (pattern) => buildInsanoPatternKey(pattern) !== previousPatternKey
    );
    const selectedPattern = pickRandom(
      candidatePatterns.length ? candidatePatterns : INSANO_PATTERNS
    );
    return Array.isArray(selectedPattern) ? selectedPattern.slice() : [];
  }

  // Este builder concentra la "musicalidad" del lobby:
  // 1. intro
  // 2. entrada alternada entre drop1-1 y drop1-2
  // 3. posible ligamento valido (1-4 o 1-3)
  // 4. posible paso por 1-5 moto o 1-6 moto
  // 5. cierre con drop1-end
  // 6. puente a la parte insana con intermedio/antes dropinsano
  // 7. variacion controlada de dropinsano1-1 y dropinsano1-2
  buildCyclePlan(snapshot = {}, options = {}) {
    const safeSnapshot = {
      completedCycleCount: Number(snapshot.completedCycleCount ?? 0),
      lastCycleEntryLabel: String(snapshot.lastCycleEntryLabel || ""),
      lastMotoLabel: String(snapshot.lastMotoLabel || ""),
      lastPostDropChoice: String(snapshot.lastPostDropChoice || ""),
      lastInsanoPatternKey: String(snapshot.lastInsanoPatternKey || ""),
      lastDropBlockKey: String(snapshot.lastDropBlockKey || ""),
    };
    const markPreviousCycleCompleted = Boolean(options.markPreviousCycleCompleted);
    const nextCompletedCycleCount =
      safeSnapshot.completedCycleCount + (markPreviousCycleCompleted ? 1 : 0);

    const entryLabel = this.pickNextDropEntry(safeSnapshot.lastCycleEntryLabel);
    const partnerLabel = DROP1_LIGAMENTS[entryLabel];
    const drop1Block = this.pickDrop1BlockOption(safeSnapshot.lastDropBlockKey);
    const plan = ["intro", entryLabel];

    let motoAccentLabel = safeSnapshot.lastMotoLabel;
    if (drop1Block?.key === "entry-partner-end" || drop1Block?.key === "entry-partner-moto-end") {
      plan.push(partnerLabel);
    }
    if (drop1Block?.key === "entry-moto-end" || drop1Block?.key === "entry-partner-moto-end") {
      motoAccentLabel = this.pickMotoAccent(safeSnapshot.lastMotoLabel);
      if (motoAccentLabel) {
        plan.push(motoAccentLabel);
      }
    }

    plan.push("drop1-end");

    const usedIntermedio = this.shouldUseIntermedio({
      ...safeSnapshot,
      completedCycleCount: nextCompletedCycleCount,
    });
    if (usedIntermedio) {
      plan.push("intermedio");
    }
    plan.push("antes dropinsano");

    const insanoPattern = this.pickInsanoPattern(safeSnapshot.lastInsanoPatternKey);
    const insanoPatternKey = buildInsanoPatternKey(insanoPattern);
    plan.push(...insanoPattern, "dropinsano1-end", "end");

    return {
      nextState: {
        currentCyclePlan: plan,
        currentCycleIndex: 0,
        completedCycleCount: nextCompletedCycleCount,
        lastCycleEntryLabel: entryLabel,
        lastMotoLabel: motoAccentLabel,
        lastPostDropChoice: usedIntermedio ? "intermedio" : "antes dropinsano",
        lastInsanoPatternKey: insanoPatternKey,
        lastDropBlockKey: String(drop1Block?.key || ""),
      },
    };
  }

  computeNextTrack(snapshot = {}) {
    const safeSnapshot = {
      currentCyclePlan: clonePlan(snapshot.currentCyclePlan),
      currentCycleIndex: Number(snapshot.currentCycleIndex ?? -1),
      completedCycleCount: Number(snapshot.completedCycleCount ?? 0),
      lastCycleEntryLabel: String(snapshot.lastCycleEntryLabel || ""),
      lastMotoLabel: String(snapshot.lastMotoLabel || ""),
      lastPostDropChoice: String(snapshot.lastPostDropChoice || ""),
      lastInsanoPatternKey: String(snapshot.lastInsanoPatternKey || ""),
      lastDropBlockKey: String(snapshot.lastDropBlockKey || ""),
    };

    if (
      safeSnapshot.currentCyclePlan.length &&
      safeSnapshot.currentCycleIndex >= 0 &&
      safeSnapshot.currentCycleIndex < safeSnapshot.currentCyclePlan.length - 1
    ) {
      const nextCycleIndex = safeSnapshot.currentCycleIndex + 1;
      return {
        nextLabel: safeSnapshot.currentCyclePlan[nextCycleIndex] || "",
        nextState: {
          ...safeSnapshot,
          currentCycleIndex: nextCycleIndex,
        },
      };
    }

    const { nextState } = this.buildCyclePlan(safeSnapshot, {
      markPreviousCycleCompleted: safeSnapshot.currentCyclePlan.length > 0,
    });
    return {
      nextLabel: nextState.currentCyclePlan[0] || "",
      nextState,
    };
  }

  startTrackNow(label, options = {}) {
    const normalizedLabel = normalizeLobbyLabel(label);
    if (!normalizedLabel) {
      return Promise.resolve(false);
    }

    const sessionId = this.sessionId;
    const fadeInMs = Math.max(0, Number(options.fadeInMs ?? 0));
    const offsetSec = Math.max(0, Number(options.offsetSec ?? 0));

    this.ensureContextRunning();

    return this.loadBuffer(normalizedLabel)
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
        const playback = this.createPlayback(normalizedLabel, buffer, startTime, offsetSec);
        if (!playback) return false;

        const previousPlayback = this.currentPlayback;
        this.cancelQueuedPlayback();
        this.currentPlayback = playback;
        this.resumeState = null;
        this.setCurrentTrack(normalizedLabel);

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

    let nextLabel = "";
    let nextState = null;

    if (this.previewMode && this.previewTrackLabel) {
      nextLabel = this.previewTrackLabel;
    } else {
      const nextPlan = this.computeNextTrack(this.getSequenceSnapshot());
      nextLabel = nextPlan.nextLabel;
      nextState = nextPlan.nextState;
    }

    if (!nextLabel) {
      this.cancelQueuedPlayback();
      return false;
    }

    const remainingMs = Math.max(0, (current.endTime - context.currentTime) * 1000);
    if (remainingMs <= this.decodeLeadMs) {
      this.loadBuffer(nextLabel).catch(() => {
        // Si falla el preload, se vuelve a intentar justo antes del cambio.
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

        let liveNextLabel = nextLabel;
        let liveNextState = nextState;
        if (!this.previewMode) {
          const livePlan = this.computeNextTrack(this.getSequenceSnapshot());
          liveNextLabel = livePlan.nextLabel;
          liveNextState = livePlan.nextState;
        }

        if (liveNextLabel !== nextLabel) {
          this.scheduleUpcomingTrack(true);
          return;
        }

        this.cancelQueuedPlayback();

        const queuedPlayback = this.createPlayback(
          liveNextLabel,
          buffer,
          liveCurrent.endTime,
          0,
          liveNextState
        );
        if (!queuedPlayback) return;
        queuedPlayback.gainNode.gain.setValueAtTime(1, queuedPlayback.startTime);
        this.queuedPlayback = queuedPlayback;
      })
      .catch(() => {
        // El ended actual hara fallback si esta cola no se pudo programar.
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
    const nextLabel = this.previewMode
      ? this.previewTrackLabel
      : this.computeNextTrack(this.getSequenceSnapshot()).nextLabel;
    if (!nextLabel) return;

    if (remainingMs <= this.decodeLeadMs) {
      this.loadBuffer(nextLabel).catch(() => {
        // Si falla el decode temprano, se reintentara al borde del cambio.
      });
    }

    if (remainingMs <= this.scheduleLeadMs || Boolean(this.queuedPlayback)) {
      this.scheduleUpcomingTrack(true);
    }
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

    if (this.previewMode && this.previewTrackLabel) {
      this.currentPlayback = null;
      this.startTrackNow(this.previewTrackLabel);
      return;
    }

    const nextPlan = this.computeNextTrack(this.getSequenceSnapshot());
    this.currentPlayback = null;
    if (!nextPlan.nextLabel) {
      this.stop({ fadeOutMs: 0 });
      return;
    }
    this.applySequenceSnapshot(nextPlan.nextState);
    this.startTrackNow(nextPlan.nextLabel);
  }

  beginFreshSequence() {
    this.previewMode = false;
    this.previewTrackLabel = "";
    this.resetSequenceState();
    const { nextState } = this.buildCyclePlan(this.getSequenceSnapshot(), {
      markPreviousCycleCompleted: false,
    });
    this.applySequenceSnapshot(nextState);
    const firstLabel = this.currentCyclePlan[0] || "intro";
    this.setCurrentTrack("");
    this.ensureContextRunning();
    this.warmAllBuffers();
    this.startTrackNow(firstLabel);
  }

  restartSequence() {
    this.sessionId += 1;
    this.shouldPlay = true;
    this.awaitingUnlock = false;
    this.suspendedForInactivity = false;
    this.resumeState = null;
    this.clearMonitor();
    this.cancelQueuedPlayback();
    if (this.currentPlayback) {
      this.stopPlaybackImmediately(this.currentPlayback);
      this.currentPlayback = null;
    }
    this.beginFreshSequence();
  }

  enterLobby(options = {}) {
    const restartIntro = options.restartIntro !== false;
    if (restartIntro || !this.currentPlayback) {
      this.restartSequence();
      return;
    }

    this.shouldPlay = true;
    if (this.awaitingUnlock) {
      this.ensurePlayback();
    }
  }

  resumePendingPlayback() {
    if (!this.shouldPlay || !this.awaitingUnlock) return;
    this.ensurePlayback();
  }

  ensurePlayback() {
    if (!this.shouldPlay) return;

    if (this.suspendedForInactivity && this.resumePlayback()) {
      return;
    }

    if (this.currentPlayback) {
      this.ensureContextRunning();
      return;
    }

    if (this.previewMode && this.previewTrackLabel) {
      this.startTrackNow(this.previewTrackLabel);
      return;
    }

    const resumeLabel =
      this.currentCyclePlan[this.currentCycleIndex] || this.currentCyclePlan[0] || "";
    if (resumeLabel) {
      this.startTrackNow(resumeLabel);
      return;
    }

    this.restartSequence();
  }

  previewTrackByLabel(label) {
    const normalizedLabel = normalizeLobbyLabel(label);
    if (!normalizedLabel) {
      return false;
    }

    this.sessionId += 1;
    this.shouldPlay = true;
    this.awaitingUnlock = false;
    this.suspendedForInactivity = false;
    this.resumeState = null;
    this.clearMonitor();
    this.cancelQueuedPlayback();
    if (this.currentPlayback) {
      this.stopPlaybackImmediately(this.currentPlayback);
      this.currentPlayback = null;
    }

    // Preview usa el mismo motor gapless, pero deja una sola pista en loop para pruebas.
    this.previewMode = true;
    this.previewTrackLabel = normalizedLabel;
    this.resetSequenceState();
    this.setCurrentTrack("");
    this.ensureContextRunning();
    this.warmAllBuffers();
    this.startTrackNow(normalizedLabel);
    return true;
  }

  suspendPlayback(options = {}) {
    const context = this.getAudioContext();
    const current = this.currentPlayback;
    if (!context || !this.shouldPlay || this.suspendedForInactivity || !current) {
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
      previewMode: this.previewMode,
      previewTrackLabel: this.previewTrackLabel,
      sequenceSnapshot: this.getSequenceSnapshot(),
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
    this.resumeState = null;
    this.previewMode = Boolean(resumeState.previewMode);
    this.previewTrackLabel = normalizeLobbyLabel(resumeState.previewTrackLabel);
    this.applySequenceSnapshot(resumeState.sequenceSnapshot);
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
    this.previewMode = false;
    this.previewTrackLabel = "";
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
