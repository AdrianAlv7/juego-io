const INTRO_SOURCE = "/assets/sound/lobby/start.ogg";
const FIRST_DROP_SOURCE = "/assets/sound/lobby/drop1.ogg";
const DROP_SOURCES = [
  "/assets/sound/lobby/drop1.ogg",
  "/assets/sound/lobby/drop2.ogg",
  "/assets/sound/lobby/dropInsano.ogg",
  "/assets/sound/lobby/end.ogg",
  "/assets/sound/lobby/intermedio.ogg",
];
const TRANSITION_OVERLAY_SOURCES = ["/assets/sound/lobby/mt09.ogg"];

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function getTrackLabel(source) {
  const normalized = String(source || "").trim();
  if (!normalized) return "";
  const fileName = normalized.split("/").pop() || normalized;
  return fileName.replace(/\.[^.]+$/, "");
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

export default class LobbyMusicController {
  // Guia rapida para retocar la musica del lobby a mano:
  // - trackGain / overlayGain: balance interno entre pista principal y puente mt09.
  // - decodeLeadMs / transitionLeadMs: cuanto antes dejamos lista la siguiente transicion.
  // - overlayDelayMs / overlayHoldMs / overlayFadeOutMs: comportamiento del mt09.
  // - nextTrackDelayMs: cuantos ms tarda en entrar la siguiente pista tras arrancar mt09.
  // - visibilityFadeOutMs / visibilityFadeInMs: reaccion cuando el juego pierde o recupera foco.
  // - pickLoopSource() y shouldSkipFadeInForTransition(): reglas de orden y excepciones.
  constructor(options = {}) {
    this.introSource = options.introSource || INTRO_SOURCE;
    this.firstLoopSource = options.firstLoopSource || FIRST_DROP_SOURCE;
    this.loopSources =
      Array.isArray(options.loopSources) && options.loopSources.length
        ? options.loopSources.filter(Boolean)
        : DROP_SOURCES.slice();
    this.overlaySources =
      Array.isArray(options.overlaySources) && options.overlaySources.length
        ? options.overlaySources.filter(Boolean)
        : TRANSITION_OVERLAY_SOURCES.slice();
    this.onTrackLabelChange =
      typeof options.onTrackLabelChange === "function" ? options.onTrackLabelChange : null;
    this.onTrackStateChange =
      typeof options.onTrackStateChange === "function" ? options.onTrackStateChange : null;
    this.masterVolume = clamp01(options.masterVolume ?? 0.72);
    // El slider de musica es el mismo para lobby y partida.
    // Aqui solo ajustamos el peso interno del lobby para que no se dispare sobre game.
    this.trackGain = clamp01(options.trackGain ?? 0.54);
    this.overlayGain = clamp01(options.overlayGain ?? 0.22);
    this.fadeInMs = Math.max(0, Number(options.fadeInMs ?? 250));
    this.fadeOutMs = Math.max(0, Number(options.fadeOutMs ?? 1050));
    this.crossfadeMs = Math.max(120, Number(options.crossfadeMs ?? 320));
    this.transitionLeadMs = Math.max(90, Number(options.transitionLeadMs ?? 340));
    this.decodeLeadMs = Math.max(250, Number(options.decodeLeadMs ?? 2400));
    this.overlayChance = clamp01(options.overlayChance ?? 1);
    this.overlayDelayMs = Math.max(0, Number(options.overlayDelayMs ?? 0));
    this.overlayFadeInMs = Math.max(0, Number(options.overlayFadeInMs ?? 36));
    this.overlayFadeOutMs = Math.max(0, Number(options.overlayFadeOutMs ?? 220));
    this.overlayHoldMs = Math.max(0, Number(options.overlayHoldMs ?? 190));
    this.nextTrackDelayMs = Math.max(0, Number(options.nextTrackDelayMs ?? 42));
    this.visibilityFadeOutMs = Math.max(0, Number(options.visibilityFadeOutMs ?? 190));
    this.visibilityFadeInMs = Math.max(0, Number(options.visibilityFadeInMs ?? 240));

    this.audioContext = null;
    this.masterGainNode = null;
    this.bufferCache = new Map();
    this.bufferWarmupStarted = false;
    this.monitorTimerId = 0;
    this.playbackIdCounter = 0;

    this.currentMainPlayback = null;
    this.queuedMainPlayback = null;
    this.currentOverlayPlayback = null;

    this.shouldPlay = false;
    this.awaitingUnlock = false;
    this.pendingIntro = true;
    this.pendingFirstLoop = true;
    this.previewMode = false;
    this.previewTrackSource = "";
    this.previewTrackPhase = "";
    this.previewTrackFadeInMs = 0;
    this.previewTrackLabel = "";
    this.suspendedForInactivity = false;
    this.sessionId = 0;
    this.transitionQueuedForPlaybackId = 0;
    this.lastLoopSource = "";
    this.lastOverlaySource = "";
    this.resumeState = null;
    this.debugPrimarySource = "";
    this.debugOverlaySource = "";
    this.debugPrimaryLabel = "";
    this.debugOverlayLabel = "";
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
    return this.audioContext;
  }

  getTrackGainValue() {
    return clamp01(this.masterVolume * this.trackGain);
  }

  getOverlayGainValue() {
    return clamp01(this.masterVolume * this.overlayGain);
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

  loadBuffer(source) {
    const normalizedSource = String(source || "");
    if (!normalizedSource) {
      return Promise.resolve(null);
    }
    if (this.bufferCache.has(normalizedSource)) {
      return this.bufferCache.get(normalizedSource);
    }

    const task = (async () => {
      const context = this.getAudioContext();
      if (!context) return null;

      const response = await fetch(normalizedSource);
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${normalizedSource}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return decodeAudioBuffer(context, arrayBuffer);
    })().catch((error) => {
      this.bufferCache.delete(normalizedSource);
      throw error;
    });

    this.bufferCache.set(normalizedSource, task);
    return task;
  }

  warmAllBuffers() {
    if (this.bufferWarmupStarted) return;
    this.bufferWarmupStarted = true;
    const sources = [this.introSource, ...this.loopSources, ...this.overlaySources];
    sources.filter(Boolean).forEach((source) => {
      this.loadBuffer(source).catch(() => {
        // Si falla un clip, se reintentara al necesitarlo.
      });
    });
  }

  // El manager global usa esto para saber si conviene esperar el fade del lobby
  // antes de arrancar la musica de partida.
  isSessionActive() {
    return Boolean(
      this.shouldPlay ||
        this.previewMode ||
        this.currentMainPlayback ||
        this.queuedMainPlayback ||
        this.currentOverlayPlayback
    );
  }

  emitTrackLabelChange() {
    const parts = [];
    if (this.debugOverlayLabel) parts.push(this.debugOverlayLabel);
    if (this.debugPrimaryLabel) parts.push(this.debugPrimaryLabel);
    this.onTrackStateChange?.({
      primaryLabel: this.debugPrimaryLabel,
      overlayLabel: this.debugOverlayLabel,
      primarySource: this.debugPrimarySource,
      overlaySource: this.debugOverlaySource,
    });
    this.onTrackLabelChange?.(parts.length ? `Musica: ${parts.join(" + ")}` : "Musica: silencio");
  }

  setDebugPrimarySource(source) {
    this.debugPrimarySource = String(source || "");
    this.debugPrimaryLabel = getTrackLabel(source);
    this.emitTrackLabelChange();
  }

  setDebugOverlaySource(source) {
    this.debugOverlaySource = String(source || "");
    this.debugOverlayLabel = getTrackLabel(source);
    this.emitTrackLabelChange();
  }

  clearDebugSources() {
    this.debugPrimarySource = "";
    this.debugOverlaySource = "";
    this.debugPrimaryLabel = "";
    this.debugOverlayLabel = "";
    this.emitTrackLabelChange();
  }

  setMasterVolume(volume) {
    this.masterVolume = clamp01(volume);

    const context = this.getAudioContext();
    if (!context) return;

    const applyGain = (playback, gainValue) => {
      if (!playback?.gainNode) return;
      playback.gainNode.gain.cancelScheduledValues(context.currentTime);
      playback.gainNode.gain.setValueAtTime(gainValue, context.currentTime);
    };

    applyGain(this.currentMainPlayback, this.getTrackGainValue());
    applyGain(this.queuedMainPlayback, this.getTrackGainValue());
    applyGain(this.currentOverlayPlayback, this.getOverlayGainValue());
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

  createPlayback(source, startTime, options = {}) {
    const context = this.getAudioContext();
    const buffer = options.buffer;
    if (!context || !this.masterGainNode || !buffer) return null;

    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    sourceNode.buffer = buffer;
    sourceNode.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    const offsetSec = Math.max(0, Number(options.offsetSec ?? 0));
    const playback = {
      id: (this.playbackIdCounter += 1),
      label: getTrackLabel(source),
      source,
      buffer,
      sourceNode,
      gainNode,
      startTime,
      offsetSec,
      endTime: startTime + Math.max(0, buffer.duration - offsetSec),
      phase: String(options.phase || "loop"),
      cleanupAfterEnd: Boolean(options.cleanupAfterEnd),
      cleanedUp: false,
    };

    sourceNode.onended = () => {
      if (playback.cleanupAfterEnd) {
        this.handleOverlayEnded(playback);
      } else {
        this.handleMainTrackEnded(playback);
      }
    };

    sourceNode.start(startTime, offsetSec);
    return playback;
  }

  getCurrentPlaybackOffset(playback = this.currentMainPlayback) {
    const context = this.getAudioContext();
    if (!context || !playback?.buffer) return 0;
    const elapsedSec = Math.max(0, context.currentTime - playback.startTime);
    return Math.max(
      0,
      Math.min(playback.buffer.duration, playback.offsetSec + elapsedSec)
    );
  }

  pickOverlaySource() {
    if (!this.overlaySources.length) return "";
    if (this.overlaySources.length === 1) return this.overlaySources[0];

    let candidate = this.overlaySources[Math.floor(Math.random() * this.overlaySources.length)];
    let attempts = 0;
    while (candidate === this.lastOverlaySource && attempts < 8) {
      candidate = this.overlaySources[Math.floor(Math.random() * this.overlaySources.length)];
      attempts += 1;
    }
    this.lastOverlaySource = candidate;
    return candidate;
  }

  stopOverlayImmediate() {
    if (this.currentOverlayPlayback) {
      this.stopPlaybackImmediately(this.currentOverlayPlayback);
      this.currentOverlayPlayback = null;
    }
    this.setDebugOverlaySource("");
  }

  playOverlayPreview(source) {
    this.ensureContextRunning();
    this.stopOverlayImmediate();

    const sessionId = this.sessionId;
    this.loadBuffer(source)
      .then((buffer) => {
        const context = this.getAudioContext();
        if (!context || !buffer || sessionId !== this.sessionId) return;

        const startTime = context.currentTime + 0.012;
        const playback = this.createPlayback(source, startTime, {
          buffer,
          cleanupAfterEnd: true,
        });
        if (!playback) return;
        playback.gainNode.gain.setValueAtTime(0, startTime);
        playback.gainNode.gain.linearRampToValueAtTime(
          this.getOverlayGainValue(),
          startTime + this.overlayFadeInMs / 1000
        );
        playback.gainNode.gain.setValueAtTime(
          this.getOverlayGainValue(),
          startTime + (this.overlayFadeInMs + this.overlayHoldMs) / 1000
        );
        playback.gainNode.gain.linearRampToValueAtTime(
          0,
          startTime +
            (this.overlayFadeInMs + this.overlayHoldMs + this.overlayFadeOutMs) / 1000
        );
        this.currentOverlayPlayback = playback;
        this.setDebugOverlaySource(source);
      })
      .catch(() => {});
  }

  handleOverlayEnded(playback) {
    this.cleanupPlayback(playback);
    if (this.currentOverlayPlayback?.id === playback.id) {
      this.currentOverlayPlayback = null;
      this.setDebugOverlaySource("");
    }
  }

  getSourceForLabel(label) {
    const normalized = String(label || "").trim();
    if (!normalized) return "";
    if (normalized === "start") return this.introSource;
    if (normalized === "mt09") return this.overlaySources[0] || "";
    return this.loopSources.find((source) => getTrackLabel(source) === normalized) || "";
  }

  // Regla especial del lobby:
  // despues de start, drop1 debe entrar directo, sin fade in, para que el arranque pegue mas.
  shouldSkipFadeInForTransition(active, nextSource) {
    return active?.phase === "intro" && nextSource === this.firstLoopSource;
  }

  // Aqui decides el orden de las pistas principales.
  // firstLoopSource fuerza la primera pieza tras start y luego todo vuelve a random sin repeticion inmediata.
  pickLoopSource() {
    if (!this.loopSources.length) {
      return this.introSource;
    }

    if (this.pendingFirstLoop) {
      this.pendingFirstLoop = false;
      if (this.loopSources.includes(this.firstLoopSource)) {
        return this.firstLoopSource;
      }
    }

    if (this.loopSources.length === 1) {
      return this.loopSources[0];
    }

    let candidate = this.loopSources[Math.floor(Math.random() * this.loopSources.length)];
    let attempts = 0;
    while (candidate === this.lastLoopSource && attempts < 8) {
      candidate = this.loopSources[Math.floor(Math.random() * this.loopSources.length)];
      attempts += 1;
    }
    return candidate;
  }

  startMainTrack(source, phase, options = {}) {
    const fadeInMs = Math.max(0, Number(options.fadeInMs ?? 0));
    const offsetSec = Math.max(0, Number(options.offsetSec ?? 0));
    const sessionId = this.sessionId;

    this.ensureContextRunning();

    return this.loadBuffer(source)
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
        const playback = this.createPlayback(source, startTime, {
          buffer,
          phase,
          offsetSec,
        });
        if (!playback) return false;

        const previous = this.currentMainPlayback;
        if (this.queuedMainPlayback) {
          this.stopPlaybackImmediately(this.queuedMainPlayback);
          this.queuedMainPlayback = null;
        }

        this.currentMainPlayback = playback;
        this.setDebugPrimarySource(source);
        this.pendingIntro = false;
        if (phase === "loop" || phase === "preview-loop") {
          this.lastLoopSource = source;
        }

        playback.gainNode.gain.setValueAtTime(0, startTime);
        if (fadeInMs > 0) {
          playback.gainNode.gain.linearRampToValueAtTime(
            this.getTrackGainValue(),
            startTime + fadeInMs / 1000
          );
        } else {
          playback.gainNode.gain.setValueAtTime(this.getTrackGainValue(), startTime);
        }

        this.ensureMonitor(sessionId);
        if (!this.previewMode) {
          this.maybeScheduleTransition(false);
        }

        if (previous) {
          this.stopPlaybackImmediately(previous);
        }
        return true;
      })
      .catch(() => false);
  }

  startPrimaryTrack(withIntro) {
    const source = withIntro ? this.introSource : this.pickLoopSource();
    const phase = withIntro ? "intro" : "loop";
    return this.startMainTrack(source, phase, { fadeInMs: this.fadeInMs });
  }

  previewTrackByLabel(label) {
    const normalized = String(label || "").trim();
    if (!normalized) return false;

    const source = this.getSourceForLabel(normalized);
    if (!source) return false;

    this.sessionId += 1;
    this.clearMonitor();
    this.stopOverlayImmediate();
    if (this.currentMainPlayback) {
      this.stopPlaybackImmediately(this.currentMainPlayback);
      this.currentMainPlayback = null;
    }
    if (this.queuedMainPlayback) {
      this.stopPlaybackImmediately(this.queuedMainPlayback);
      this.queuedMainPlayback = null;
    }
    this.resumeState = null;
    this.shouldPlay = false;
    this.awaitingUnlock = false;
    this.pendingIntro = false;
    this.pendingFirstLoop = false;
    this.previewMode = false;
    this.previewTrackSource = "";
    this.previewTrackPhase = "";
    this.previewTrackFadeInMs = 0;
    this.previewTrackLabel = "";
    this.setDebugPrimarySource("");

    if (normalized === "mt09") {
      this.playOverlayPreview(source);
      return true;
    }

    this.previewMode = true;
    this.previewTrackSource = source;
    this.previewTrackPhase = normalized === "start" ? "preview-intro" : "preview-loop";
    this.previewTrackFadeInMs = source === this.firstLoopSource ? 0 : this.fadeInMs;
    this.previewTrackLabel = normalized;
    this.shouldPlay = true;
    this.startMainTrack(source, this.previewTrackPhase, {
      fadeInMs: this.previewTrackFadeInMs,
    });
    return true;
  }

  restartSequence(options = {}) {
    const withIntro = options.withIntro !== false;
    this.sessionId += 1;
    this.clearMonitor();
    this.stopOverlayImmediate();
    if (this.currentMainPlayback) {
      this.stopPlaybackImmediately(this.currentMainPlayback);
      this.currentMainPlayback = null;
    }
    if (this.queuedMainPlayback) {
      this.stopPlaybackImmediately(this.queuedMainPlayback);
      this.queuedMainPlayback = null;
    }

    this.previewMode = false;
    this.previewTrackSource = "";
    this.previewTrackPhase = "";
    this.previewTrackFadeInMs = 0;
    this.previewTrackLabel = "";
    this.shouldPlay = true;
    this.awaitingUnlock = false;
    this.suspendedForInactivity = false;
    this.pendingIntro = withIntro;
    this.pendingFirstLoop = withIntro;
    this.resumeState = null;
    this.lastLoopSource = "";
    this.lastOverlaySource = "";
    this.transitionQueuedForPlaybackId = 0;
    this.clearDebugSources();
    this.ensureContextRunning();
    this.warmAllBuffers();
    this.startPrimaryTrack(withIntro);
  }

  enterLobby(options = {}) {
    const restartIntro = options.restartIntro !== false;
    if (restartIntro) {
      this.restartSequence({ withIntro: true });
      return;
    }

    this.shouldPlay = true;
    if (this.awaitingUnlock || !this.currentMainPlayback) {
      this.restartSequence({ withIntro: false });
    }
  }

  resumePendingPlayback() {
    if (!this.shouldPlay || !this.awaitingUnlock) return;
    this.restartSequence({ withIntro: this.pendingIntro });
  }

  ensurePlayback() {
    if (!this.shouldPlay) {
      if (this.previewMode && this.previewTrackSource) {
        this.shouldPlay = true;
      } else {
        return;
      }
    }

    if (this.suspendedForInactivity && this.resumePlayback()) {
      return;
    }

    if (this.currentMainPlayback) {
      this.ensureContextRunning();
      return;
    }

    if (this.previewMode && this.previewTrackSource) {
      this.startMainTrack(this.previewTrackSource, this.previewTrackPhase || "preview-loop", {
        fadeInMs: this.previewTrackFadeInMs,
      });
      return;
    }

    this.restartSequence({ withIntro: this.pendingIntro });
  }

  suspendPlayback(options = {}) {
    const context = this.getAudioContext();
    const current = this.currentMainPlayback;
    if (!this.shouldPlay) return false;
    if (this.suspendedForInactivity) return true;
    if (!context || !current) return false;

    const fadeOutMs = Math.max(0, Number(options.fadeOutMs ?? this.visibilityFadeOutMs));
    const sessionId = this.sessionId + 1;
    const resumeOffsetSec = this.getCurrentPlaybackOffset(current);

    this.sessionId = sessionId;
    this.suspendedForInactivity = true;
    this.awaitingUnlock = false;
    this.clearMonitor();

    if (current.phase === "intro" && !this.lastLoopSource) {
      this.pendingFirstLoop = true;
    }

    this.resumeState = {
      source: current.source,
      phase: current.phase,
      offsetSec: resumeOffsetSec,
      pendingIntro: this.pendingIntro,
      pendingFirstLoop: this.pendingFirstLoop,
      lastLoopSource: this.lastLoopSource,
      lastOverlaySource: this.lastOverlaySource,
      previewMode: this.previewMode,
      previewTrackSource: this.previewTrackSource,
      previewTrackPhase: this.previewTrackPhase,
      previewTrackFadeInMs: this.previewTrackFadeInMs,
      previewTrackLabel: this.previewTrackLabel,
    };

    if (this.queuedMainPlayback) {
      this.stopPlaybackImmediately(this.queuedMainPlayback);
      this.queuedMainPlayback = null;
    }

    current.gainNode.gain.cancelScheduledValues(context.currentTime);
    current.gainNode.gain.setValueAtTime(current.gainNode.gain.value, context.currentTime);
    current.gainNode.gain.linearRampToValueAtTime(
      0,
      context.currentTime + fadeOutMs / 1000
    );

    if (this.currentOverlayPlayback) {
      this.currentOverlayPlayback.gainNode.gain.cancelScheduledValues(context.currentTime);
      this.currentOverlayPlayback.gainNode.gain.setValueAtTime(
        this.currentOverlayPlayback.gainNode.gain.value,
        context.currentTime
      );
      this.currentOverlayPlayback.gainNode.gain.linearRampToValueAtTime(
        0,
        context.currentTime + Math.max(0, Math.min(fadeOutMs, this.overlayFadeOutMs)) / 1000
      );
    }

    window.setTimeout(() => {
      if (sessionId !== this.sessionId || !this.suspendedForInactivity) return;
      if (this.currentMainPlayback?.id === current.id) {
        this.stopPlaybackImmediately(current);
        this.currentMainPlayback = null;
      }
      this.stopOverlayImmediate();
    }, fadeOutMs + 48);

    return true;
  }

  resumePlayback(options = {}) {
    if (!this.shouldPlay || !this.suspendedForInactivity || !this.resumeState) {
      return false;
    }

    const resumeState = this.resumeState;
    const fadeInMs = Math.max(0, Number(options.fadeInMs ?? this.visibilityFadeInMs));

    this.sessionId += 1;
    this.suspendedForInactivity = false;
    this.pendingIntro = Boolean(resumeState.pendingIntro);
    this.pendingFirstLoop = Boolean(resumeState.pendingFirstLoop);
    this.lastLoopSource = String(resumeState.lastLoopSource || "");
    this.lastOverlaySource = String(resumeState.lastOverlaySource || "");
    this.previewMode = Boolean(resumeState.previewMode);
    this.previewTrackSource = String(resumeState.previewTrackSource || "");
    this.previewTrackPhase = String(resumeState.previewTrackPhase || "");
    this.previewTrackFadeInMs = Number(resumeState.previewTrackFadeInMs || 0);
    this.previewTrackLabel = String(resumeState.previewTrackLabel || "");
    this.resumeState = null;
    this.stopOverlayImmediate();

    this.startMainTrack(resumeState.source, resumeState.phase, {
      offsetSec: resumeState.offsetSec,
      fadeInMs,
    });
    return true;
  }

  monitorPlayback(sessionId) {
    if (sessionId !== this.sessionId || !this.shouldPlay || this.previewMode) {
      return;
    }

    const context = this.getAudioContext();
    const current = this.currentMainPlayback;
    if (!context || !current) return;

    const remainingMs = Math.max(0, (current.endTime - context.currentTime) * 1000);
    const dynamicLeadMs = Math.max(
      60,
      Math.min(this.transitionLeadMs, Math.max(60, current.buffer.duration * 1000 * 0.12))
    );
    if (remainingMs <= dynamicLeadMs) {
      this.maybeScheduleTransition(false);
    }
  }

  maybeScheduleTransition(force = false) {
    const context = this.getAudioContext();
    const current = this.currentMainPlayback;
    if (!context || !current || !this.shouldPlay || this.suspendedForInactivity || this.previewMode) {
      return false;
    }

    if (this.transitionQueuedForPlaybackId === current.id) {
      return true;
    }

    const remainingMs = Math.max(0, (current.endTime - context.currentTime) * 1000);
    const nextSource = this.pickLoopSource();
    if (!nextSource) {
      return false;
    }

    if (remainingMs <= this.decodeLeadMs) {
      this.loadBuffer(nextSource).catch(() => {
        // Se reintentara si la transicion sigue pendiente.
      });
      this.overlaySources.forEach((source) => {
        this.loadBuffer(source).catch(() => {
          // El overlay es opcional; si falla, la pista principal sigue.
        });
      });
    }

    const shouldQueueNow =
      force ||
      remainingMs <= this.transitionLeadMs ||
      Boolean(this.queuedMainPlayback);
    if (!shouldQueueNow) {
      return false;
    }

    const overlaySource =
      this.overlaySources.length && Math.random() <= this.overlayChance
        ? this.pickOverlaySource()
        : "";
    const skipFadeIn = this.shouldSkipFadeInForTransition(current, nextSource);
    const nextTrackFadeInMs = skipFadeIn ? 0 : this.crossfadeMs;
    const overlayStartTime = current.endTime + this.overlayDelayMs / 1000;
    const nextTrackStartTime = overlayStartTime + this.nextTrackDelayMs / 1000;
    const fadeOutStartTime = Math.max(
      context.currentTime,
      current.endTime - this.crossfadeMs / 1000
    );

    this.loadBuffer(nextSource)
      .then((buffer) => {
        const liveContext = this.getAudioContext();
        const liveCurrent = this.currentMainPlayback;
        if (
          !liveContext ||
          !buffer ||
          !liveCurrent ||
          liveCurrent.id !== current.id ||
          !this.shouldPlay ||
          this.suspendedForInactivity ||
          this.previewMode
        ) {
          return;
        }

        if (this.queuedMainPlayback) {
          this.stopPlaybackImmediately(this.queuedMainPlayback);
          this.queuedMainPlayback = null;
        }

        const queuedPlayback = this.createPlayback(nextSource, nextTrackStartTime, {
          buffer,
          phase: "loop",
        });
        if (!queuedPlayback) return;

        queuedPlayback.gainNode.gain.setValueAtTime(0, nextTrackStartTime);
        if (nextTrackFadeInMs > 0) {
          queuedPlayback.gainNode.gain.linearRampToValueAtTime(
            this.getTrackGainValue(),
            nextTrackStartTime + nextTrackFadeInMs / 1000
          );
        } else {
          queuedPlayback.gainNode.gain.setValueAtTime(
            this.getTrackGainValue(),
            nextTrackStartTime
          );
        }

        liveCurrent.gainNode.gain.cancelScheduledValues(fadeOutStartTime);
        liveCurrent.gainNode.gain.setValueAtTime(
          this.getTrackGainValue(),
          fadeOutStartTime
        );
        liveCurrent.gainNode.gain.linearRampToValueAtTime(0, liveCurrent.endTime);

        this.queuedMainPlayback = queuedPlayback;
        this.transitionQueuedForPlaybackId = liveCurrent.id;

        if (overlaySource) {
          this.scheduleOverlayTransition(overlaySource, overlayStartTime, nextTrackStartTime);
        }
      })
      .catch(() => {});

    return true;
  }

  scheduleOverlayTransition(source, overlayStartTime, nextTrackStartTime) {
    this.loadBuffer(source)
      .then((buffer) => {
        const context = this.getAudioContext();
        if (!context || !buffer || !this.shouldPlay || this.suspendedForInactivity) {
          return;
        }

        if (this.currentOverlayPlayback) {
          this.stopPlaybackImmediately(this.currentOverlayPlayback);
          this.currentOverlayPlayback = null;
        }

        const overlayPlayback = this.createPlayback(source, overlayStartTime, {
          buffer,
          cleanupAfterEnd: true,
        });
        if (!overlayPlayback) return;

        overlayPlayback.gainNode.gain.setValueAtTime(0, overlayStartTime);
        overlayPlayback.gainNode.gain.linearRampToValueAtTime(
          this.getOverlayGainValue(),
          overlayStartTime + this.overlayFadeInMs / 1000
        );
        overlayPlayback.gainNode.gain.setValueAtTime(
          this.getOverlayGainValue(),
          Math.max(
            overlayStartTime + this.overlayFadeInMs / 1000,
            nextTrackStartTime + this.overlayHoldMs / 1000
          )
        );
        overlayPlayback.gainNode.gain.linearRampToValueAtTime(
          0,
          Math.max(
            overlayStartTime + this.overlayFadeInMs / 1000,
            nextTrackStartTime + (this.overlayHoldMs + this.overlayFadeOutMs) / 1000
          )
        );

        this.currentOverlayPlayback = overlayPlayback;
        this.setDebugOverlaySource(source);
      })
      .catch(() => {});
  }

  handleMainTrackEnded(playback) {
    this.cleanupPlayback(playback);

    if (!this.shouldPlay) {
      if (this.currentMainPlayback?.id === playback.id) {
        this.currentMainPlayback = null;
        this.setDebugPrimarySource("");
      }
      return;
    }

    if (this.currentMainPlayback?.id !== playback.id) {
      if (this.queuedMainPlayback?.id === playback.id) {
        this.queuedMainPlayback = null;
      }
      return;
    }

    if (this.previewMode && this.previewTrackSource) {
      this.currentMainPlayback = null;
      this.startMainTrack(this.previewTrackSource, this.previewTrackPhase || "preview-loop", {
        fadeInMs: this.previewTrackFadeInMs,
      });
      return;
    }

    if (this.queuedMainPlayback) {
      this.currentMainPlayback = this.queuedMainPlayback;
      this.queuedMainPlayback = null;
      this.transitionQueuedForPlaybackId = 0;
      this.lastLoopSource = this.currentMainPlayback.source;
      this.setDebugPrimarySource(this.currentMainPlayback.source);
      this.ensureMonitor(this.sessionId);
      return;
    }

    this.currentMainPlayback = null;
    this.transitionQueuedForPlaybackId = 0;
    this.setDebugPrimarySource("");
    const source = this.pickLoopSource();
    if (!source) {
      this.stop({ fadeOutMs: 0 });
      return;
    }
    this.startMainTrack(source, "loop", { fadeInMs: this.fadeInMs });
  }

  stop(options = {}) {
    const fadeOutMs = Math.max(0, Number(options.fadeOutMs ?? this.fadeOutMs));
    const context = this.getAudioContext();
    const current = this.currentMainPlayback;
    const overlay = this.currentOverlayPlayback;

    this.previewMode = false;
    this.previewTrackSource = "";
    this.previewTrackPhase = "";
    this.previewTrackFadeInMs = 0;
    this.previewTrackLabel = "";
    this.shouldPlay = false;
    this.awaitingUnlock = false;
    this.suspendedForInactivity = false;
    this.pendingIntro = true;
    this.pendingFirstLoop = true;
    this.sessionId += 1;
    this.clearMonitor();
    this.resumeState = null;
    this.transitionQueuedForPlaybackId = 0;

    if (this.queuedMainPlayback) {
      this.stopPlaybackImmediately(this.queuedMainPlayback);
      this.queuedMainPlayback = null;
    }

    const sessionId = this.sessionId;
    const finalizeStop = () => {
      if (sessionId !== this.sessionId) return;
      if (this.currentMainPlayback?.id === current?.id) {
        this.stopPlaybackImmediately(current);
        this.currentMainPlayback = null;
      }
      if (this.currentOverlayPlayback?.id === overlay?.id) {
        this.stopPlaybackImmediately(overlay);
        this.currentOverlayPlayback = null;
      }
      this.clearDebugSources();
    };

    if (!context || !current) {
      if (overlay) {
        this.stopPlaybackImmediately(overlay);
        this.currentOverlayPlayback = null;
      }
      this.clearDebugSources();
      return;
    }

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

    if (overlay) {
      overlay.gainNode.gain.cancelScheduledValues(context.currentTime);
      overlay.gainNode.gain.setValueAtTime(overlay.gainNode.gain.value, context.currentTime);
      overlay.gainNode.gain.linearRampToValueAtTime(
        0,
        context.currentTime + Math.max(0, Math.min(fadeOutMs, this.overlayFadeOutMs)) / 1000
      );
    }

    window.setTimeout(finalizeStop, fadeOutMs + 48);
  }

  destroy() {
    this.stop({ fadeOutMs: 0 });
    this.clearMonitor();
    this.stopOverlayImmediate();
    if (this.currentMainPlayback) {
      this.stopPlaybackImmediately(this.currentMainPlayback);
      this.currentMainPlayback = null;
    }
    if (this.queuedMainPlayback) {
      this.stopPlaybackImmediately(this.queuedMainPlayback);
      this.queuedMainPlayback = null;
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
