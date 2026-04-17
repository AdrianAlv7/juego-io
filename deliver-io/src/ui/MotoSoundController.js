const MOTO_SOUND_SOURCES = Object.freeze({
  idle: "/assets/sound/effects/moto/relenti.ogg",
  idleReverse: encodeURI("/assets/sound/effects/moto/relenti invertido.ogg"),
  accelerate: "/assets/sound/effects/moto/aceleracion.ogg",
  decelerate: "/assets/sound/effects/moto/desaceleracion.ogg",
  turbo: "/assets/sound/effects/moto/turbo.ogg",
});

const MOTO_SOUND_BASE_GAINS = Object.freeze({
  idle: 0.42,
  idleReverse: 0.4,
  accelerate: 0.56,
  decelerate: 0.5,
  turbo: 0.72,
});

const ROLE_IDLE = "idle";
const ROLE_ACCEL_A = "accelA";
const ROLE_ACCEL_B = "accelB";
const ROLE_DECEL = "decel";
const ROLE_TURBO = "turbo";
const ROLE_NAMES = Object.freeze([
  ROLE_IDLE,
  ROLE_ACCEL_A,
  ROLE_ACCEL_B,
  ROLE_DECEL,
  ROLE_TURBO,
]);

const IDLE_RETURN_SPEED_KMH = 10;
const MATCH_START_IDLE_DELAY_MS = 1000;
const IDLE_FADE_IN_MS = 160;
const TURBO_CROSSFADE_OUT_MS = 250;
const TURBO_EXIT_ACCEL_CROSSFADE_MS = 120;
const TURBO_END_FADE_OUT_MS = 180;
const TURBO_MIN_LAYER_FADE_IN_MS = 160;
const PLAYBACK_START_LEAD_SEC = 0.005;
const QUEUED_PROMOTION_TOLERANCE_SEC = 0.06;

const ACCEL_RATE_BY_STAGE = Object.freeze([
  Object.freeze({ min: 1.16, max: 1.28 }),
  Object.freeze({ min: 1.08, max: 1.18 }),
  Object.freeze({ min: 1.0, max: 1.12 }),
  Object.freeze({ min: 0.94, max: 1.05 }),
]);

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function pickBetween(min, max) {
  return min + Math.random() * Math.max(0, max - min);
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

function createRoleState(name) {
  return {
    name,
    intentToken: 0,
    currentPlayback: null,
    queuedPlayback: null,
    pendingNow: false,
    pendingQueue: false,
  };
}

function weightedIdlePick(previousKey, repeatCount) {
  const options = [
    {
      key: "idle",
      weight: previousKey === "idle" ? (repeatCount >= 1 ? 1 : 3) : 5,
    },
    {
      key: "idleReverse",
      weight: previousKey === "idleReverse" ? (repeatCount >= 1 ? 2 : 4) : 6,
    },
  ];
  const totalWeight = options.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const entry of options) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.key;
    }
  }
  return options[options.length - 1]?.key || "idle";
}

function buildNextIdleSelection(previousKey, previousRepeatCount) {
  const nextKey = weightedIdlePick(previousKey, previousRepeatCount);
  return {
    key: nextKey,
    repeatCount: nextKey === previousKey ? previousRepeatCount + 1 : 0,
  };
}

export default class MotoSoundController {
  constructor(options = {}) {
    this.masterVolume = clamp01(options.masterVolume ?? 1);
    this.audioContext = null;
    this.masterGainNode = null;
    this.bufferCache = new Map();
    this.resolvedBuffers = new Map();
    this.bufferWarmupStarted = false;
    this.awaitingUnlock = false;
    this.playbackIdCounter = 0;

    this.roles = {
      [ROLE_IDLE]: createRoleState(ROLE_IDLE),
      [ROLE_ACCEL_A]: createRoleState(ROLE_ACCEL_A),
      [ROLE_ACCEL_B]: createRoleState(ROLE_ACCEL_B),
      [ROLE_DECEL]: createRoleState(ROLE_DECEL),
      [ROLE_TURBO]: createRoleState(ROLE_TURBO),
    };

    this.mode = "off";
    this.matchActive = false;
    this.suspended = false;
    this.pendingStartAtMs = 0;
    this.lastSpeedKmh = 0;
    this.lastDecayKmhPerSec = 0;
    this.throttleHeldMs = 0;
    this.lastIdleKey = "";
    this.lastIdleRepeatCount = 0;
    this.currentAccelRoleName = "";
    this.latestRuntime = null;
    this.lastTurboActive = false;
    this.turboFadeTimeoutId = 0;
  }

  getRole(roleName) {
    return this.roles[roleName] || null;
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
    this.masterGainNode.gain.setValueAtTime(clamp01(this.masterVolume), context.currentTime);
  }

  setMasterVolume(masterVolume) {
    this.masterVolume = clamp01(masterVolume);
    this.applyMasterGain();
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

  ensurePlayback() {
    this.ensureContextRunning();
    this.warmAllBuffers();
  }

  loadBuffer(label) {
    const source = MOTO_SOUND_SOURCES[label];
    if (!source) return Promise.resolve(null);
    if (this.resolvedBuffers.has(label)) {
      return Promise.resolve(this.resolvedBuffers.get(label));
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
      const buffer = await decodeAudioBuffer(context, arrayBuffer);
      if (buffer) {
        this.resolvedBuffers.set(label, buffer);
      }
      return buffer;
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
    Object.keys(MOTO_SOUND_SOURCES).forEach((label) => {
      this.loadBuffer(label).catch(() => {
        // Si un decode falla, se reintentara cuando la pista haga falta.
      });
    });
  }

  getBufferDurationSec(label) {
    return Number(this.resolvedBuffers.get(label)?.duration || 0);
  }

  getBaseGainForLabel(label) {
    return clamp01(MOTO_SOUND_BASE_GAINS[label] ?? 1);
  }

  fitRateToDuration(label, desiredMs, minRate, maxRate, fallbackRate = 1) {
    const durationSec = this.getBufferDurationSec(label);
    if (durationSec <= 0 || desiredMs <= 0) return fallbackRate;
    return clamp((durationSec * 1000) / desiredMs, minRate, maxRate);
  }

  bumpRoleIntent(roleName) {
    const role = this.getRole(roleName);
    if (!role) return 0;
    role.intentToken += 1;
    role.pendingNow = false;
    role.pendingQueue = false;
    return role.intentToken;
  }

  createPlayback(roleName, label, buffer, startTime, options = {}) {
    const context = this.getAudioContext();
    if (!context || !this.masterGainNode || !buffer) return null;

    const rate = clamp(Number(options.rate || 1), 0.45, 1.65);
    const fadeInSec = Math.max(0, Number(options.fadeInMs || 0)) / 1000;
    const targetGain = clamp01(
      (options.gain ?? 1) * this.getBaseGainForLabel(label)
    );

    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();

    sourceNode.buffer = buffer;
    sourceNode.playbackRate.setValueAtTime(rate, startTime);
    sourceNode.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    if (fadeInSec > 0) {
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(targetGain, startTime + fadeInSec);
    } else {
      gainNode.gain.setValueAtTime(targetGain, startTime);
    }

    const playback = {
      id: (this.playbackIdCounter += 1),
      roleName,
      label,
      buffer,
      sourceNode,
      gainNode,
      startTime,
      endTime: startTime + buffer.duration / rate,
      targetGain,
      rate,
      intentToken: Number(options.intentToken || 0),
      onEnded: typeof options.onEnded === "function" ? options.onEnded : null,
      onPromote: typeof options.onPromote === "function" ? options.onPromote : null,
      meta: options.meta || {},
      cleanedUp: false,
    };

    sourceNode.onended = () => {
      this.handlePlaybackEnded(playback);
    };
    sourceNode.start(startTime);
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

  fadeOutPlayback(playback, fadeOutMs = 0) {
    if (!playback) return;
    const context = this.getAudioContext();
    const safeFadeOutMs = Math.max(0, Number(fadeOutMs || 0));
    if (!context || safeFadeOutMs <= 0) {
      this.stopPlaybackImmediately(playback);
      return;
    }
    if (context.currentTime < playback.startTime - 0.01) {
      this.stopPlaybackImmediately(playback);
      return;
    }

    const now = context.currentTime;
    const endAt = now + safeFadeOutMs / 1000;
    try {
      playback.gainNode.gain.cancelScheduledValues(now);
      playback.gainNode.gain.setValueAtTime(
        playback.gainNode.gain.value,
        now
      );
      playback.gainNode.gain.linearRampToValueAtTime(0, endAt);
      playback.sourceNode.stop(endAt + 0.02);
    } catch (_error) {
      this.stopPlaybackImmediately(playback);
    }
  }

  cancelQueuedRolePlayback(roleName) {
    const role = this.getRole(roleName);
    if (!role?.queuedPlayback) {
      role && (role.pendingQueue = false);
      return;
    }
    this.stopPlaybackImmediately(role.queuedPlayback);
    role.queuedPlayback = null;
    role.pendingQueue = false;
  }

  stopRole(roleName, options = {}) {
    const role = this.getRole(roleName);
    if (!role) return;
    this.bumpRoleIntent(roleName);
    this.cancelQueuedRolePlayback(roleName);
    const currentPlayback = role.currentPlayback;
    role.currentPlayback = null;
    if (!currentPlayback) return;
    this.fadeOutPlayback(currentPlayback, options.fadeOutMs);
  }

  stopAllRoles(options = {}) {
    ROLE_NAMES.forEach((roleName) => {
      this.stopRole(roleName, options);
    });
  }

  handlePlaybackEnded(playback) {
    if (!playback) return;
    const role = this.getRole(playback.roleName);
    this.cleanupPlayback(playback);
    if (!role) {
      playback.onEnded?.(playback);
      return;
    }

    if (role.currentPlayback?.id === playback.id) {
      const queuedPlayback = role.queuedPlayback;
      if (
        queuedPlayback &&
        queuedPlayback.startTime <=
          (this.audioContext?.currentTime ?? playback.endTime) +
            QUEUED_PROMOTION_TOLERANCE_SEC
      ) {
        role.currentPlayback = queuedPlayback;
        role.queuedPlayback = null;
        role.pendingQueue = false;
        queuedPlayback.onPromote?.(queuedPlayback);
      } else {
        role.currentPlayback = null;
      }
      playback.onEnded?.(playback);
      return;
    }

    if (role.queuedPlayback?.id === playback.id) {
      role.queuedPlayback = null;
      role.pendingQueue = false;
    }
    playback.onEnded?.(playback);
  }

  playRoleNow(roleName, label, options = {}) {
    const role = this.getRole(roleName);
    if (!role || role.pendingNow) return Promise.resolve(null);

    const intentToken = Number(options.intentToken ?? role.intentToken);
    role.pendingNow = true;
    return this.loadBuffer(label)
      .then((buffer) => {
        if (!buffer) return null;
        if (role.intentToken !== intentToken) return null;
        const context = this.getAudioContext();
        if (!context) return null;

        const requestedStartTime = Number(options.startTime || 0);
        const startTime = Math.max(
          context.currentTime + PLAYBACK_START_LEAD_SEC,
          requestedStartTime || context.currentTime + PLAYBACK_START_LEAD_SEC
        );
        const playback = this.createPlayback(roleName, label, buffer, startTime, {
          ...options,
          intentToken,
        });
        if (!playback) return null;
        role.currentPlayback = playback;
        return playback;
      })
      .finally(() => {
        role.pendingNow = false;
      });
  }

  queueRoleAfterCurrent(roleName, currentPlayback, label, options = {}) {
    const role = this.getRole(roleName);
    if (!role || !currentPlayback || role.pendingQueue) {
      return Promise.resolve(null);
    }

    const intentToken = Number(options.intentToken ?? role.intentToken);
    const expectedCurrentId = currentPlayback.id;
    role.pendingQueue = true;
    return this.loadBuffer(label)
      .then((buffer) => {
        if (!buffer) return null;
        if (role.intentToken !== intentToken) return null;
        if (role.currentPlayback?.id !== expectedCurrentId) return null;

        this.cancelQueuedRolePlayback(roleName);
        const startTime = Math.max(
          currentPlayback.endTime,
          (this.audioContext?.currentTime || 0) + PLAYBACK_START_LEAD_SEC
        );
        const queuedPlayback = this.createPlayback(roleName, label, buffer, startTime, {
          ...options,
          fadeInMs: 0,
          intentToken,
        });
        if (!queuedPlayback) return null;
        role.queuedPlayback = queuedPlayback;
        return queuedPlayback;
      })
      .finally(() => {
        role.pendingQueue = false;
      });
  }

  clearTurboFadeTimeout() {
    if (!this.turboFadeTimeoutId || typeof window === "undefined") return;
    window.clearTimeout(this.turboFadeTimeoutId);
    this.turboFadeTimeoutId = 0;
  }

  startMatch(options = {}) {
    const nowMs = Math.max(0, Number(options.nowMs || performance.now()));
    const delayMs = Math.max(0, Number(options.delayMs ?? MATCH_START_IDLE_DELAY_MS));
    this.matchActive = true;
    this.mode = "pending";
    this.pendingStartAtMs = nowMs + delayMs;
    this.lastSpeedKmh = 0;
    this.lastDecayKmhPerSec = 0;
    this.throttleHeldMs = 0;
    this.lastIdleKey = "";
    this.lastIdleRepeatCount = 0;
    this.currentAccelRoleName = "";
    this.latestRuntime = null;
    this.lastTurboActive = false;
    this.clearTurboFadeTimeout();
    this.ensurePlayback();
    this.stopAllRoles({ fadeOutMs: 0 });
  }

  stopMatch(options = {}) {
    this.matchActive = false;
    this.mode = "off";
    this.pendingStartAtMs = 0;
    this.lastSpeedKmh = 0;
    this.lastDecayKmhPerSec = 0;
    this.throttleHeldMs = 0;
    this.currentAccelRoleName = "";
    this.latestRuntime = null;
    this.lastTurboActive = false;
    this.clearTurboFadeTimeout();
    this.stopAllRoles({ fadeOutMs: Math.max(0, Number(options.fadeOutMs || 0)) });
  }

  setSuspended(suspended) {
    const nextSuspended = Boolean(suspended);
    if (nextSuspended === this.suspended) return;
    this.suspended = nextSuspended;
    if (this.suspended) {
      this.stopAllRoles({ fadeOutMs: 120 });
      this.mode = this.matchActive ? "pending" : "off";
      return;
    }
    this.ensurePlayback();
  }

  update(runtime = {}) {
    this.latestRuntime = {
      nowMs: Math.max(0, Number(runtime.nowMs || performance.now())),
      deltaMs: Math.max(0, Number(runtime.deltaMs || 0)),
      speedKmh: Math.max(0, Number(runtime.speedKmh || 0)),
      accelerating: Boolean(runtime.accelerating),
      braking: Boolean(runtime.braking),
      turboActive: Boolean(runtime.turboActive),
      turboRemainingMs: Math.max(0, Number(runtime.turboRemainingMs || 0)),
    };

    const {
      nowMs,
      deltaMs,
      speedKmh,
      accelerating,
      braking,
      turboActive,
      turboRemainingMs,
    } = this.latestRuntime;

    if (!this.matchActive) {
      this.stopMatch({ fadeOutMs: 0 });
      return;
    }
    if (this.suspended) return;
    if (nowMs < this.pendingStartAtMs) return;

    const speedDrop = Math.max(0, this.lastSpeedKmh - speedKmh);
    if (deltaMs > 0 && speedDrop > 0.05) {
      const instantDecay = speedDrop / Math.max(0.001, deltaMs / 1000);
      const blend = accelerating || turboActive ? 0.14 : 0.34;
      this.lastDecayKmhPerSec =
        this.lastDecayKmhPerSec > 0
          ? this.lastDecayKmhPerSec * (1 - blend) + instantDecay * blend
          : instantDecay;
    } else if (accelerating || turboActive) {
      this.lastDecayKmhPerSec *= 0.92;
    }

    if (accelerating) {
      this.throttleHeldMs = Math.min(12000, this.throttleHeldMs + deltaMs);
    } else if (!turboActive) {
      this.throttleHeldMs = 0;
    }

    const turboJustStarted = turboActive && !this.lastTurboActive;
    const turboJustEnded = !turboActive && this.lastTurboActive;
    this.lastTurboActive = turboActive;

    if (turboJustStarted) {
      this.enterTurbo(speedKmh, turboRemainingMs);
      this.lastSpeedKmh = speedKmh;
      return;
    }

    if (turboActive) {
      if (this.mode !== "turbo") {
        this.enterTurbo(speedKmh, turboRemainingMs);
      }
      this.lastSpeedKmh = speedKmh;
      return;
    }

    if (turboJustEnded) {
      this.stopRole(ROLE_TURBO, { fadeOutMs: 110 });
    }

    if (accelerating) {
      this.enterAcceleration(speedKmh);
    } else if (speedKmh > IDLE_RETURN_SPEED_KMH) {
      this.enterDeceleration(speedKmh, braking);
    } else {
      this.enterIdle(IDLE_FADE_IN_MS);
    }

    this.lastSpeedKmh = speedKmh;
  }

  enterIdle(fadeInMs = IDLE_FADE_IN_MS) {
    const idleRole = this.getRole(ROLE_IDLE);
    if (!this.matchActive || !idleRole) return;

    if (this.mode !== "idle") {
      this.mode = "idle";
      this.clearTurboFadeTimeout();
      this.currentAccelRoleName = "";
      this.stopRole(ROLE_ACCEL_A, { fadeOutMs: 0 });
      this.stopRole(ROLE_ACCEL_B, { fadeOutMs: 0 });
      this.stopRole(ROLE_DECEL, { fadeOutMs: 0 });
      this.stopRole(ROLE_TURBO, { fadeOutMs: 80 });
    }

    if (
      idleRole.currentPlayback ||
      idleRole.queuedPlayback ||
      idleRole.pendingNow
    ) {
      return;
    }

    const intentToken = this.bumpRoleIntent(ROLE_IDLE);
    this.startIdleChain(fadeInMs, intentToken);
  }

  startIdleChain(fadeInMs, intentToken) {
    const selection = buildNextIdleSelection(
      this.lastIdleKey,
      this.lastIdleRepeatCount
    );
    this.lastIdleKey = selection.key;
    this.lastIdleRepeatCount = selection.repeatCount;

    this.playRoleNow(ROLE_IDLE, selection.key, {
      intentToken,
      fadeInMs,
      gain: 1,
      meta: {
        idleKey: selection.key,
        idleRepeatCount: selection.repeatCount,
      },
      onPromote: (playback) => {
        this.lastIdleKey = playback.meta?.idleKey || this.lastIdleKey;
        this.lastIdleRepeatCount = Number(
          playback.meta?.idleRepeatCount ?? this.lastIdleRepeatCount
        );
        if (
          this.mode === "idle" &&
          this.matchActive &&
          !this.suspended &&
          this.getRole(ROLE_IDLE)?.intentToken === intentToken
        ) {
          this.queueNextIdle(playback, intentToken);
        }
      },
      onEnded: () => {
        const role = this.getRole(ROLE_IDLE);
        if (
          this.mode !== "idle" ||
          !this.matchActive ||
          this.suspended ||
          role?.currentPlayback ||
          role?.queuedPlayback
        ) {
          return;
        }
        this.startIdleChain(0, intentToken);
      },
    }).then((playback) => {
      if (!playback) return;
      if (
        this.mode === "idle" &&
        this.matchActive &&
        !this.suspended &&
        this.getRole(ROLE_IDLE)?.intentToken === intentToken
      ) {
        this.queueNextIdle(playback, intentToken);
      }
    });
  }

  queueNextIdle(currentPlayback, intentToken) {
    const selection = buildNextIdleSelection(
      this.lastIdleKey,
      this.lastIdleRepeatCount
    );
    this.queueRoleAfterCurrent(ROLE_IDLE, currentPlayback, selection.key, {
      intentToken,
      gain: 1,
      meta: {
        idleKey: selection.key,
        idleRepeatCount: selection.repeatCount,
      },
      onPromote: (playback) => {
        this.lastIdleKey = playback.meta?.idleKey || this.lastIdleKey;
        this.lastIdleRepeatCount = Number(
          playback.meta?.idleRepeatCount ?? this.lastIdleRepeatCount
        );
        if (
          this.mode === "idle" &&
          this.matchActive &&
          !this.suspended &&
          this.getRole(ROLE_IDLE)?.intentToken === intentToken
        ) {
          this.queueNextIdle(playback, intentToken);
        }
      },
      onEnded: () => {
        const role = this.getRole(ROLE_IDLE);
        if (
          this.mode !== "idle" ||
          !this.matchActive ||
          this.suspended ||
          role?.currentPlayback ||
          role?.queuedPlayback
        ) {
          return;
        }
        this.startIdleChain(0, intentToken);
      },
    });
  }

  resolveGearStage(speedKmh) {
    const stageBySpeed =
      speedKmh >= 80 ? 3 : speedKmh >= 56 ? 2 : speedKmh >= 24 ? 1 : 0;
    const holdMs = this.throttleHeldMs;
    const stageByHold =
      holdMs >= 3600 ? 3 : holdMs >= 2100 ? 2 : holdMs >= 850 ? 1 : 0;
    return Math.max(stageBySpeed, stageByHold);
  }

  buildAccelerationClipOptions(speedKmh, turboLayer, fadeInMs = 0) {
    const stage = turboLayer ? 3 : this.resolveGearStage(speedKmh);
    const rateRange = ACCEL_RATE_BY_STAGE[stage] || ACCEL_RATE_BY_STAGE[0];
    return {
      rate: turboLayer
        ? pickBetween(1.18, 1.34)
        : pickBetween(rateRange.min, rateRange.max),
      gain: turboLayer ? 0.74 : 1,
      fadeInMs: Math.max(0, Number(fadeInMs || 0)),
    };
  }

  getInactiveAccelRoleName(roleName) {
    return roleName === ROLE_ACCEL_A ? ROLE_ACCEL_B : ROLE_ACCEL_A;
  }

  shouldMaintainAccelerationRole(roleName, turboLayer) {
    const runtime = this.latestRuntime;
    if (!runtime || !this.matchActive || this.suspended) return false;
    if (roleName !== this.currentAccelRoleName) return false;
    if (turboLayer) {
      return this.mode === "turbo" && runtime.turboActive;
    }
    return this.mode === "accel" && runtime.accelerating && !runtime.turboActive;
  }

  startAccelerationChain(roleName, options = {}) {
    const role = this.getRole(roleName);
    if (!role) return;

    const intentToken = Number(options.intentToken ?? role.intentToken);
    const turboLayer = Boolean(options.turboLayer);
    const speedKmh = Math.max(0, Number(options.speedKmh || 0));
    const clipOptions = this.buildAccelerationClipOptions(
      speedKmh,
      turboLayer,
      options.fadeInMs
    );

    this.playRoleNow(roleName, "accelerate", {
      intentToken,
      ...clipOptions,
      meta: {
        turboLayer,
      },
      onPromote: (playback) => {
        if (this.shouldMaintainAccelerationRole(roleName, turboLayer)) {
          this.queueNextAcceleration(roleName, playback, intentToken, turboLayer);
        }
      },
      onEnded: () => {
        const nextRole = this.getRole(roleName);
        if (
          nextRole?.currentPlayback ||
          nextRole?.queuedPlayback ||
          !this.shouldMaintainAccelerationRole(roleName, turboLayer)
        ) {
          return;
        }
        const runtime = this.latestRuntime;
        this.startAccelerationChain(roleName, {
          speedKmh: runtime?.speedKmh ?? speedKmh,
          turboLayer,
          fadeInMs: 0,
          intentToken,
        });
      },
    }).then((playback) => {
      if (!playback) return;
      if (this.shouldMaintainAccelerationRole(roleName, turboLayer)) {
        this.queueNextAcceleration(roleName, playback, intentToken, turboLayer);
      }
    });
  }

  queueNextAcceleration(roleName, currentPlayback, intentToken, turboLayer) {
    if (!this.shouldMaintainAccelerationRole(roleName, turboLayer)) return;

    const runtime = this.latestRuntime || {};
    const clipOptions = this.buildAccelerationClipOptions(
      Math.max(0, Number(runtime.speedKmh || 0)),
      turboLayer,
      0
    );

    this.queueRoleAfterCurrent(roleName, currentPlayback, "accelerate", {
      intentToken,
      ...clipOptions,
      meta: {
        turboLayer,
      },
      onPromote: (playback) => {
        if (this.shouldMaintainAccelerationRole(roleName, turboLayer)) {
          this.queueNextAcceleration(roleName, playback, intentToken, turboLayer);
        }
      },
      onEnded: () => {
        const role = this.getRole(roleName);
        if (
          role?.currentPlayback ||
          role?.queuedPlayback ||
          !this.shouldMaintainAccelerationRole(roleName, turboLayer)
        ) {
          return;
        }
        const nextRuntime = this.latestRuntime || {};
        this.startAccelerationChain(roleName, {
          speedKmh: Math.max(0, Number(nextRuntime.speedKmh || 0)),
          turboLayer,
          fadeInMs: 0,
          intentToken,
        });
      },
    });
  }

  enterAcceleration(speedKmh) {
    if (!this.matchActive) return;

    const previousMode = this.mode;
    if (this.mode !== "accel") {
      this.mode = "accel";
      this.clearTurboFadeTimeout();
      this.stopRole(ROLE_IDLE, { fadeOutMs: 0 });
      this.stopRole(ROLE_DECEL, { fadeOutMs: 0 });
      this.stopRole(ROLE_TURBO, { fadeOutMs: 80 });
    }

    let roleName = this.currentAccelRoleName || ROLE_ACCEL_A;
    const role = this.getRole(roleName);
    const needsTurboExitSwap =
      previousMode === "turbo" ||
      Boolean(role?.currentPlayback?.meta?.turboLayer) ||
      Boolean(role?.queuedPlayback?.meta?.turboLayer);

    if (needsTurboExitSwap) {
      this.stopRole(roleName, { fadeOutMs: TURBO_EXIT_ACCEL_CROSSFADE_MS });
      roleName = this.getInactiveAccelRoleName(roleName);
      this.stopRole(roleName, { fadeOutMs: 0 });
      this.currentAccelRoleName = roleName;
    } else {
      this.stopRole(this.getInactiveAccelRoleName(roleName), { fadeOutMs: 0 });
      this.currentAccelRoleName = roleName;
    }

    const activeRole = this.getRole(this.currentAccelRoleName);
    if (
      activeRole?.currentPlayback ||
      activeRole?.queuedPlayback ||
      activeRole?.pendingNow
    ) {
      return;
    }

    const intentToken = this.bumpRoleIntent(this.currentAccelRoleName);
    this.startAccelerationChain(this.currentAccelRoleName, {
      speedKmh,
      turboLayer: false,
      fadeInMs: needsTurboExitSwap ? 90 : 0,
      intentToken,
    });
  }

  estimateDecelerationMs(speedKmh, braking) {
    const targetSpeed = braking ? 0 : IDLE_RETURN_SPEED_KMH;
    if (speedKmh <= targetSpeed) return 260;
    const fallbackDecay = speedKmh >= 70 ? 52 : speedKmh >= 35 ? 36 : 24;
    const decayKmhPerSec = Math.max(10, this.lastDecayKmhPerSec || fallbackDecay);
    const estimatedMs = ((speedKmh - targetSpeed) / decayKmhPerSec) * 1000;
    return clamp(estimatedMs, 320, 2400);
  }

  enterDeceleration(speedKmh, braking) {
    if (!this.matchActive) return;

    if (this.mode !== "decel") {
      this.mode = "decel";
      this.clearTurboFadeTimeout();
      this.currentAccelRoleName = "";
      this.stopRole(ROLE_IDLE, { fadeOutMs: 0 });
      this.stopRole(ROLE_ACCEL_A, { fadeOutMs: 0 });
      this.stopRole(ROLE_ACCEL_B, { fadeOutMs: 0 });
      this.stopRole(ROLE_TURBO, { fadeOutMs: 100 });
    }

    const role = this.getRole(ROLE_DECEL);
    if (role?.currentPlayback || role?.pendingNow) return;

    const estimatedMs = this.estimateDecelerationMs(speedKmh, braking);
    const rate = this.fitRateToDuration(
      "decelerate",
      estimatedMs,
      0.68,
      1.2,
      0.92
    );
    const intentToken = this.bumpRoleIntent(ROLE_DECEL);
    this.playRoleNow(ROLE_DECEL, "decelerate", {
      intentToken,
      rate,
      gain: 1,
      fadeInMs: 40,
      onEnded: () => {
        if (!this.matchActive || this.suspended || this.mode !== "decel") return;
        const runtime = this.latestRuntime;
        if (!runtime) return;
        if (runtime.turboActive) {
          this.enterTurbo(runtime.speedKmh, runtime.turboRemainingMs);
          return;
        }
        if (runtime.accelerating) {
          this.enterAcceleration(runtime.speedKmh);
          return;
        }
        if (runtime.speedKmh > IDLE_RETURN_SPEED_KMH + 2) {
          this.enterDeceleration(runtime.speedKmh, runtime.braking);
          return;
        }
        this.enterIdle(90);
      },
    });
  }

  scheduleTurboFadeOut(turboRemainingMs) {
    this.clearTurboFadeTimeout();
    if (typeof window === "undefined") return;
    const fadeLeadMs = Math.min(
      TURBO_END_FADE_OUT_MS,
      Math.max(90, turboRemainingMs * 0.35)
    );
    const triggerInMs = Math.max(30, turboRemainingMs - fadeLeadMs);
    this.turboFadeTimeoutId = window.setTimeout(() => {
      this.turboFadeTimeoutId = 0;
      if (this.mode !== "turbo") return;
      this.stopRole(ROLE_TURBO, { fadeOutMs: fadeLeadMs });
    }, triggerInMs);
  }

  enterTurbo(speedKmh, turboRemainingMs) {
    if (!this.matchActive) return;

    this.mode = "turbo";
    this.throttleHeldMs = Math.max(this.throttleHeldMs, 2100);
    this.stopRole(ROLE_IDLE, { fadeOutMs: 0 });
    this.stopRole(ROLE_DECEL, { fadeOutMs: 0 });

    const outgoingRoleName = this.currentAccelRoleName || ROLE_ACCEL_A;
    const incomingRoleName = this.getInactiveAccelRoleName(outgoingRoleName);

    this.stopRole(outgoingRoleName, { fadeOutMs: TURBO_CROSSFADE_OUT_MS });
    this.stopRole(incomingRoleName, { fadeOutMs: 0 });
    this.currentAccelRoleName = incomingRoleName;

    const accelIntentToken = this.bumpRoleIntent(incomingRoleName);
    this.startAccelerationChain(incomingRoleName, {
      speedKmh: Math.max(speedKmh, 55),
      turboLayer: true,
      fadeInMs: Math.max(TURBO_MIN_LAYER_FADE_IN_MS, turboRemainingMs),
      intentToken: accelIntentToken,
    });

    const turboRole = this.getRole(ROLE_TURBO);
    if (!turboRole?.currentPlayback && !turboRole?.pendingNow) {
      const targetTurboMs = Math.max(220, turboRemainingMs + TURBO_END_FADE_OUT_MS);
      const turboRate = this.fitRateToDuration(
        "turbo",
        targetTurboMs,
        0.78,
        1.32,
        1
      );
      const turboIntentToken = this.bumpRoleIntent(ROLE_TURBO);
      this.playRoleNow(ROLE_TURBO, "turbo", {
        intentToken: turboIntentToken,
        rate: turboRate,
        gain: 1,
        fadeInMs: 30,
      });
    }

    this.scheduleTurboFadeOut(turboRemainingMs);
  }

  destroy() {
    this.clearTurboFadeTimeout();
    this.stopAllRoles({ fadeOutMs: 0 });
    this.bufferCache.clear();
    this.resolvedBuffers.clear();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.masterGainNode = null;
  }
}
