// Gameplay runtime del GameScene.
// Agrupa eventos de red durante la partida, clima, camaras, HUD, suppression EMP y loop update.
import Phaser from "phaser";
import { ITEM_CONFIG, ITEM_TYPES } from "../../items/catalog.js";
import {
  WEATHER_EVENT_CONFIG,
  WEATHER_EVENT_TYPES,
} from "../../events/weather/catalog.js";
import appAudioManager from "../../ui/AppAudioManager.js";
import { speedPxPerSecToKmh } from "../../world/race/utils/telemetry.js";
import {
  CAMERA_DELTA_CAP_MS,
  CAMERA_LOOK_AHEAD_MAX,
  CAMERA_ZOOM_SETTINGS,
  DELTA_SPIKE_RESET_MS,
  DESIGN_VIEWPORT_HEIGHT,
  DESIGN_VIEWPORT_WIDTH,
  FIXED_STEP_MS,
  HIGH_SPEED_CAMERA_FEEL,
  HUD_FILTER_REFRESH_MS,
  MAX_ACCUMULATED_DELTA_MS,
  MAX_CATCH_UP_STEPS,
  OFFSET_DAMPING,
  RESUME_STABILIZE_FRAMES,
  TOP_SPEED_SCREEN_FX,
  WEATHER_OVERLAY_DAMPING,
  ZOOM_DAMPING,
  damp,
} from "./constants.js";

export const gameSceneGameplayMethods = {
  onWeatherEventQueued(payload = {}) {
    this.applyWeatherEventPayload(payload, "countdown");
  },

  onWeatherEventStarted(payload = {}) {
    this.applyWeatherEventPayload(payload, "active");
  },

  onWeatherEventEnded() {
    this.clearLocalWeatherEventState();
  },

  onTrainEventStarted(payload = {}) {
    this.map?.startTrainEvent?.(payload);
  },

  onTrainEventEnded(payload = {}) {
    this.map?.endTrainEvent?.(payload);
  },

  onTrackItemsSnapshot(payload = {}) {
    this.map?.setTrackItems?.(payload.items || []);
  },

  onTrackItemAdded(payload = {}) {
    this.map?.upsertTrackItem?.(payload);
  },

  onTrackItemUpdated(payload = {}) {
    this.map?.upsertTrackItem?.(payload);
  },

  onTrackItemRemoved(payload = {}) {
    this.map?.removeTrackItem?.(payload.id);
  },

  onInventoryState(payload = {}) {
    this.itemInventoryState = payload;
    this.refreshItemUi();
  },

  onInventoryItemActivated(payload = {}) {
    if (!this.matchRunning) return;
    if (payload.type !== ITEM_TYPES.SHIELD) return;
    if (this.shieldEffectSystem?.activate(this.map?.getMotoMaxHealth?.())) {
      if (!this.usingGameplayHudKit) {
        this.statusBanner.setText("Escudo activo");
        this.statusBanner.setColor("#7fe7ff");
        this.statusBanner.setVisible(true);
      }
    }
  },

  onEmpPulseStarted(payload = {}) {
    this.empPulseVisual?.trigger({
      ...payload,
      color: ITEM_CONFIG[ITEM_TYPES.EMP].draw.color,
      ringColor: ITEM_CONFIG[ITEM_TYPES.EMP].draw.ringColor,
    });

    if (!this.matchRunning || !this.moto) return;
    if (payload.ownerId === this.multiplayer?.selfId) return;

    const radius = Math.max(
      80,
      Number(payload.radius || ITEM_CONFIG[ITEM_TYPES.EMP].radius)
    );
    const distance = Math.hypot(
      Number(payload.x || 0) - this.moto.sprite.x,
      Number(payload.y || 0) - this.moto.sprite.y
    );
    if (distance > radius) return;

    this.moto.applyEmpEffect({
      durationMs: Number(
        payload.effectDurationMs || ITEM_CONFIG[ITEM_TYPES.EMP].effectDurationMs
      ),
      initialSpeedFactor: ITEM_CONFIG[ITEM_TYPES.EMP].initialSpeedFactor,
      handling: ITEM_CONFIG[ITEM_TYPES.EMP].handling,
    });
    this.startEmpHudSuppression(
      Number(
        payload.effectDurationMs || ITEM_CONFIG[ITEM_TYPES.EMP].effectDurationMs
      )
    );
    this.cameras.main.shake(280, 0.005);
  },

  startEmpHudSuppression(durationMs) {
    const safeDurationMs = Math.max(200, Number(durationMs || 0));
    if (this.empHudSuppressedUntilMs <= this.time.now) {
      this.statusBannerVisibleBeforeEmp = Boolean(this.statusBanner?.visible);
    }
    this.empHudSuppressedUntilMs = Math.max(
      this.empHudSuppressedUntilMs,
      this.time.now + safeDurationMs
    );
    this.applyEmpHudSuppression(true);
  },

  applyEmpHudSuppression(suppressed) {
    this.hud?.setVisible?.(!suppressed);
    this.statusBanner?.setVisible(
      suppressed ? false : Boolean(this.statusBannerVisibleBeforeEmp)
    );
    if (this.usingGameplayHudKit) {
      this.weatherEventText?.setVisible(false);
      this.weatherHintText?.setVisible(false);
      this.weatherButtons.forEach((button) => {
        button.background.setVisible(false);
        button.label.setVisible(false);
        button.background.disableInteractive();
      });
      this.itemPanel?.setVisible(false);
      this.itemPanel?.setHostControlsVisible(false);
      this.stockPanel?.setVisible(false);
      this.stockPanel?.setHostControlsVisible(false);
      this.setDebugFinishUiVisible(false);
    } else {
      this.weatherEventText?.setVisible(!suppressed && this.matchRunning);
      this.weatherHintText?.setVisible(
        !suppressed && this.matchRunning && this.isLocalHost()
      );
      this.weatherButtons.forEach((button) => {
        const visible = !suppressed && this.isLocalHost() && !this.matchEnded;
        button.background.setVisible(visible);
        button.label.setVisible(visible);
        button.background.disableInteractive();
        if (visible) {
          button.background.setInteractive({ useHandCursor: true });
        }
      });
      this.itemPanel?.setVisible(!suppressed && this.matchRunning && !this.matchEnded);
      this.itemPanel?.setHostControlsVisible(
        !suppressed && this.matchRunning && !this.matchEnded && this.isLocalHost()
      );
      this.stockPanel?.setVisible(!suppressed && this.matchRunning && !this.matchEnded);
      this.stockPanel?.setHostControlsVisible(
        !suppressed && this.matchRunning && !this.matchEnded && this.isLocalHost()
      );
      this.setDebugFinishUiVisible(
        !suppressed && this.matchRunning && !this.matchEnded
      );
    }
    this.map?.setGuideSuppressed?.(suppressed);
  },

  ensureHudCamera() {
    const { width, height } = this.scale.gameSize;
    if (!this.hudCamera) {
      this.hudCamera = this.cameras.add(0, 0, width, height);
      this.hudCamera.setName("hud-camera");
    } else {
      this.hudCamera.setViewport(0, 0, width, height);
    }

    this.hudCamera.setScroll(0, 0);
    this.hudCamera.setZoom(CAMERA_ZOOM_SETTINGS.hudBaseZoom);
  },

  ensureEffectCamera() {
    const { width, height } = this.scale.gameSize;
    if (!this.effectCamera) {
      this.effectCamera = this.cameras.add(0, 0, width, height);
      this.effectCamera.setName("effects-camera");
    } else {
      this.effectCamera.setViewport(0, 0, width, height);
    }

    this.effectCamera.setScroll(0, 0);
    this.effectCamera.setBackgroundColor("rgba(0, 0, 0, 0)");
  },

  applyHudCameraFilters() {
    if (!this.hud || !this.hudCamera) return;

    const mainCam = this.cameras.main;
    const hudObjects = new Set(this.hud.getHudObjects?.() || []);
    const effectObjects = new Set(this.nightVisionOverlay?.getObjects?.() || []);

    this.children.list.forEach((gameObject) => {
      if (!gameObject) return;
      if (effectObjects.has(gameObject)) {
        mainCam.ignore(gameObject);
        this.hudCamera.ignore(gameObject);
      } else if (hudObjects.has(gameObject) || gameObject.__isHudObject) {
        this.effectCamera?.ignore(gameObject);
        mainCam.ignore(gameObject);
      } else {
        this.hudCamera.ignore(gameObject);
        this.effectCamera?.ignore(gameObject);
      }
    });
  },

  applyWeatherEventPayload(payload = {}, phase = "active") {
    if (!this.matchRunning || !this.moto) return;

    const config = WEATHER_EVENT_CONFIG[payload.type];
    if (!config) return;

    const startsAtMs = Number(payload.startsAt || payload.startedAt || Date.now());
    const endsAtMs = Number(
      payload.endsAt || payload.startedAt + config.durationMs || Date.now()
    );

    this.weatherEvent = {
      type: config.type,
      phase,
      label: payload.label || config.label,
      startsAtMs,
      endsAtMs,
      overlayColor: config.overlayColor,
      overlayAlpha: config.overlayAlpha,
      accentColor: config.accentColor,
      source: payload.source || "",
    };

    if (config.type === WEATHER_EVENT_TYPES.NIGHT) {
      this.weatherOverlay?.setVisible(false);
      this.weatherOverlay?.setAlpha(0);
      this.weatherOverlayAlpha = 0;
    } else {
      this.weatherOverlay?.setFillStyle(config.overlayColor, 1);
      this.weatherOverlay?.setVisible(true);
    }

    if (phase === "active") {
      this.moto.setWeatherEvent({
        type: config.type,
        handling: config.handling,
        heat: config.heat,
      });
    } else {
      this.moto.setWeatherEvent(null);
    }
    this.setRainEmitterActive(
      phase === "active" && config.type === WEATHER_EVENT_TYPES.RAIN
    );
    this.refreshWeatherUi();
  },

  clearLocalWeatherEventState() {
    this.weatherEvent = this.createEmptyWeatherEventState();
    this.moto?.setWeatherEvent(null);
    this.nightVisionOverlay?.setActive(false);
    this.setRainEmitterActive(false);
    this.refreshWeatherUi();
  },

  updateWeatherEvent(deltaMs) {
    if (
      this.weatherEvent.phase === "active" &&
      this.weatherEvent.type !== WEATHER_EVENT_TYPES.NONE &&
      Date.now() >= this.weatherEvent.endsAtMs
    ) {
      this.clearLocalWeatherEventState();
    }

    const overlayTargetAlpha =
      this.matchRunning &&
      this.weatherEvent.phase === "active" &&
      this.weatherEvent.type !== WEATHER_EVENT_TYPES.NIGHT
        ? this.weatherEvent.overlayAlpha
        : 0;
    this.weatherOverlayAlpha = damp(
      this.weatherOverlayAlpha,
      overlayTargetAlpha,
      WEATHER_OVERLAY_DAMPING,
      deltaMs
    );

    if (this.weatherOverlay) {
      this.weatherOverlay.setAlpha(this.weatherOverlayAlpha);
      this.weatherOverlay.setVisible(this.weatherOverlayAlpha > 0.01);
    }
    const isNightActive =
      this.matchRunning &&
      this.weatherEvent.phase === "active" &&
      this.weatherEvent.type === WEATHER_EVENT_TYPES.NIGHT;
    const nightConfig =
      WEATHER_EVENT_CONFIG[WEATHER_EVENT_TYPES.NIGHT].nightVision || {};
    this.nightVisionOverlay?.setActive(isNightActive, {
      blockedRatio: nightConfig.blockedRatio ?? 0.35,
      color: nightConfig.color ?? 0x000000,
      alpha: nightConfig.alpha ?? 1,
    });
    this.setRainEmitterActive(
      this.matchRunning &&
        this.weatherEvent.phase === "active" &&
        this.weatherEvent.type === WEATHER_EVENT_TYPES.RAIN
    );

    this.refreshWeatherUi();
  },

  syncNightVisionFocus() {
    if (!this.nightVisionOverlay || !this.moto) return;

    const cam = this.cameras.main;
    if (!cam) return;

    cam.preRender();
    const worldView = cam.worldView;
    const screenX =
      ((this.moto.sprite.x - worldView.x) / Math.max(1, worldView.width)) *
        cam.width +
      cam.x;
    const screenY =
      ((this.moto.sprite.y - worldView.y) / Math.max(1, worldView.height)) *
        cam.height +
      cam.y;
    this.nightVisionOverlay.setFocus(screenX, screenY);
  },

  updateCameraAndHud(deltaMs) {
    if (!this.moto || !this.hud || !this.map) return;

    const cam = this.cameras.main;
    const speedRatio = Phaser.Math.Clamp(
      this.moto.speedPxPerSec / this.moto.maxSpeedPxPerSec,
      0,
      1
    );
    const speedKmh = speedPxPerSecToKmh(this.moto.speedPxPerSec);
    const highSpeedBlend = Phaser.Math.Clamp(
      (speedKmh - HIGH_SPEED_CAMERA_FEEL.triggerKmh) /
        HIGH_SPEED_CAMERA_FEEL.blendRangeKmh,
      0,
      1
    );
    const topSpeedBlend = Phaser.Math.Clamp(
      (speedKmh - TOP_SPEED_SCREEN_FX.triggerKmh) /
        TOP_SPEED_SCREEN_FX.blendRangeKmh,
      0,
      1
    );
    const topSpeedIntensity =
      speedKmh >= TOP_SPEED_SCREEN_FX.triggerKmh
        ? TOP_SPEED_SCREEN_FX.baseIntensityAtTrigger +
          (1 - TOP_SPEED_SCREEN_FX.baseIntensityAtTrigger) * topSpeedBlend
        : 0;
    const now = this.time.now;

    const baseTargetZoom = Phaser.Math.Linear(
      CAMERA_ZOOM_SETTINGS.baseZoom,
      CAMERA_ZOOM_SETTINGS.fastZoom,
      speedRatio
    );
    const highSpeedZoomPulse =
      Math.sin(now * HIGH_SPEED_CAMERA_FEEL.offsetWaveFreqX) *
      HIGH_SPEED_CAMERA_FEEL.zoomPulseAmplitude *
      highSpeedBlend;
    const topSpeedZoomPulse =
      Math.sin(now * TOP_SPEED_SCREEN_FX.shakeFreqX) *
      TOP_SPEED_SCREEN_FX.zoomPulseAmplitude *
      topSpeedIntensity;
    const targetZoom =
      baseTargetZoom -
      HIGH_SPEED_CAMERA_FEEL.maxExtraZoomOut * highSpeedBlend -
      TOP_SPEED_SCREEN_FX.extraZoomOut * topSpeedIntensity +
      highSpeedZoomPulse +
      topSpeedZoomPulse;
    const viewportWidth = this.scale.gameSize.width || DESIGN_VIEWPORT_WIDTH;
    const viewportHeight = this.scale.gameSize.height || DESIGN_VIEWPORT_HEIGHT;
    const viewportScale = Math.max(
      viewportWidth / DESIGN_VIEWPORT_WIDTH,
      viewportHeight / DESIGN_VIEWPORT_HEIGHT
    );
    const compensatedScale = Phaser.Math.Linear(
      1,
      viewportScale,
      CAMERA_ZOOM_SETTINGS.viewportCompensation
    );
    const compensatedZoom = targetZoom * compensatedScale;
    cam.setZoom(damp(cam.zoom, compensatedZoom, ZOOM_DAMPING, deltaMs));
    if (this.hudCamera) {
      const hudTargetZoom = Phaser.Math.Linear(
        CAMERA_ZOOM_SETTINGS.hudBaseZoom,
        CAMERA_ZOOM_SETTINGS.hudFastZoom,
        speedRatio
      );
      this.hudCamera.setZoom(
        damp(
          this.hudCamera.zoom,
          hudTargetZoom,
          CAMERA_ZOOM_SETTINGS.hudDamping,
          deltaMs
        )
      );
    }

    const lookAheadDistance = CAMERA_LOOK_AHEAD_MAX * speedRatio;
    const speedWaveAmplitude =
      HIGH_SPEED_CAMERA_FEEL.offsetWaveAmplitudePx * highSpeedBlend;
    const speedWaveX =
      Math.sin(now * HIGH_SPEED_CAMERA_FEEL.offsetWaveFreqX) * speedWaveAmplitude;
    const speedWaveY =
      Math.cos(now * HIGH_SPEED_CAMERA_FEEL.offsetWaveFreqY) *
      speedWaveAmplitude *
      0.25;
    const horizontalShakeWave =
      Math.sin(now * TOP_SPEED_SCREEN_FX.shakeFreqX) +
      Math.sin(now * TOP_SPEED_SCREEN_FX.shakeFreqXSecondary) *
        TOP_SPEED_SCREEN_FX.shakeSecondaryWeight;
    const topShakeX =
      horizontalShakeWave *
      TOP_SPEED_SCREEN_FX.shakeAmplitudePx *
      topSpeedIntensity;
    const topShakeY =
      Math.sin(now * TOP_SPEED_SCREEN_FX.shakeFreqY) *
      TOP_SPEED_SCREEN_FX.verticalDriftPx *
      topSpeedIntensity;
    const targetOffsetX =
      Math.cos(this.moto.direction) * lookAheadDistance + speedWaveX + topShakeX;
    const targetOffsetY =
      Math.sin(this.moto.direction) * lookAheadDistance + speedWaveY + topShakeY;
    this.cameraOffsetX = damp(
      this.cameraOffsetX,
      targetOffsetX,
      OFFSET_DAMPING,
      deltaMs
    );
    this.cameraOffsetY = damp(
      this.cameraOffsetY,
      targetOffsetY,
      OFFSET_DAMPING,
      deltaMs
    );
    cam.setFollowOffset(this.cameraOffsetX, this.cameraOffsetY);
    this.syncNightVisionFocus();
    const mapHudInfo = this.map.getHudInfo?.(this.moto) || {};
    this.refreshPositiveStockUi();
    const finishWindowRemainingMs = this.finishWindowEndsAtMs
      ? Math.max(0, this.finishWindowEndsAtMs - Date.now())
      : 0;
    const motoHudInfo = {
      ...(mapHudInfo.moto || {}),
      ...(this.moto.getHudState?.() || {}),
    };
    this.hud.update(this.moto, deltaMs, {
      ...mapHudInfo,
      moto: motoHudInfo,
      timing: {
        ...(mapHudInfo.timing || {}),
        finishWindowRemainingMs,
      },
      inventory: this.itemInventoryState,
      stock: this.positiveStockSystem?.getHudState?.() || {},
      weatherEvent: {
        ...(this.weatherEvent || {}),
      },
      minimap: {
        localPlayer: {
          x: this.moto.sprite.x,
          y: this.moto.sprite.y,
          angle: this.moto.direction,
        },
        remotePlayers: this.multiplayer?.getRemotePlayerStates?.() || [],
        objective: this.map?.getMinimapTarget?.() || null,
      },
      match: {
        running: this.matchRunning,
        ended: this.matchEnded,
        lobbyReturnAtMs: this.lobbyReturnAtMs,
        isHost: this.isLocalHost(),
      },
      resultText: this.matchResultText,
    });
  },

  update(_time, delta) {
    this.multiplayer?.update(delta);
    this.empPulseVisual?.update();

    if (!this.matchRunning) {
      const countdownEndsAt = Number(this.currentLobbyState?.lobbyCountdownEndsAt || 0);
      if (countdownEndsAt > Date.now()) {
        const remainingSeconds = Math.max(
          0,
          Math.ceil((countdownEndsAt - Date.now()) / 1000)
        );
        if (remainingSeconds !== this.lobbyCountdownLastSecond) {
          this.lobbyCountdownLastSecond = remainingSeconds;
          this.renderLobbyState?.();
        }
      } else if (this.lobbyCountdownLastSecond !== -1) {
        this.lobbyCountdownLastSecond = -1;
        this.renderLobbyState?.();
      }
      return;
    }
    const keyboardActive = this.input?.keyboard?.enabled !== false;

    if (
      keyboardActive &&
      this.isLocalHost() &&
      Phaser.Input.Keyboard.JustDown(this.rainEventKey)
    ) {
      this.multiplayer?.emitQueueWeatherEvent(WEATHER_EVENT_TYPES.RAIN);
    }
    if (
      keyboardActive &&
      this.isLocalHost() &&
      Phaser.Input.Keyboard.JustDown(this.sunnyEventKey)
    ) {
      this.multiplayer?.emitQueueWeatherEvent(WEATHER_EVENT_TYPES.SUNNY);
    }
    if (
      keyboardActive &&
      this.isLocalHost() &&
      Phaser.Input.Keyboard.JustDown(this.nightEventKey)
    ) {
      this.multiplayer?.emitQueueWeatherEvent(WEATHER_EVENT_TYPES.NIGHT);
    }
    if (
      keyboardActive &&
      this.isLocalHost() &&
      Phaser.Input.Keyboard.JustDown(this.clearWeatherEventKey)
    ) {
      this.multiplayer?.emitClearWeatherEvent();
    }
    if (
      keyboardActive &&
      this.isLocalHost() &&
      Phaser.Input.Keyboard.JustDown(this.trainEventKey)
    ) {
      this.multiplayer?.emitStartTrainEvent();
    }
    if (
      keyboardActive &&
      this.isLocalHost() &&
      (Phaser.Input.Keyboard.JustDown(this.grantOilKey) ||
        Phaser.Input.Keyboard.JustDown(this.grantOilNumpadKey))
    ) {
      this.multiplayer?.emitGrantItem(ITEM_TYPES.OIL);
    }
    if (
      keyboardActive &&
      this.isLocalHost() &&
      (Phaser.Input.Keyboard.JustDown(this.grantWallKey) ||
        Phaser.Input.Keyboard.JustDown(this.grantWallNumpadKey))
    ) {
      this.multiplayer?.emitGrantItem(ITEM_TYPES.WALL);
    }
    if (
      keyboardActive &&
      this.isLocalHost() &&
      (Phaser.Input.Keyboard.JustDown(this.grantEmpKey) ||
        Phaser.Input.Keyboard.JustDown(this.grantEmpNumpadKey))
    ) {
      this.multiplayer?.emitGrantItem(ITEM_TYPES.EMP);
    }
    if (
      keyboardActive &&
      this.isLocalHost() &&
      (Phaser.Input.Keyboard.JustDown(this.grantShieldKey) ||
        Phaser.Input.Keyboard.JustDown(this.grantShieldNumpadKey))
    ) {
      this.multiplayer?.emitGrantItem(ITEM_TYPES.SHIELD);
    }
    if (keyboardActive && Phaser.Input.Keyboard.JustDown(this.dropItemKey)) {
      this.multiplayer?.emitDropItem();
    }
    if (keyboardActive && Phaser.Input.Keyboard.JustDown(this.turboKey)) {
      if (this.positiveStockSystem?.useTurbo(this.moto)) {
        this.refreshPositiveStockUi();
        this.cameras.main.shake(140, 0.0022);
      }
    }

    if (this.empHudSuppressedUntilMs > 0) {
      const stillSuppressed = this.time.now < this.empHudSuppressedUntilMs;
      this.applyEmpHudSuppression(stillSuppressed);
      if (!stillSuppressed) {
        this.empHudSuppressedUntilMs = 0;
        this.refreshWeatherUi();
        this.refreshItemUi();
        this.refreshPositiveStockUi();
      }
    }

    this.hudFilterAccumulatorMs += delta;
    if (this.hudFilterAccumulatorMs >= HUD_FILTER_REFRESH_MS) {
      this.hudFilterAccumulatorMs = 0;
      this.applyHudCameraFilters();
    }

      if (
        this.matchEnded &&
        keyboardActive &&
        Phaser.Input.Keyboard.JustDown(this.restartLevelKey) &&
        this.currentLobbyState?.hostId === this.multiplayer.selfId
      ) {
      this.multiplayer.emitRestartLobby();
      return;
    }

    const cappedDelta = Math.min(delta, MAX_ACCUMULATED_DELTA_MS);
    const presentationDelta = Math.min(cappedDelta, CAMERA_DELTA_CAP_MS);
    this.updateWeatherEvent(presentationDelta);

    if (cappedDelta >= DELTA_SPIKE_RESET_MS) {
      this.simulationAccumulatorMs = 0;
      this.noCatchUpFrames = Math.max(
        this.noCatchUpFrames,
        RESUME_STABILIZE_FRAMES
      );
    }

    if (this.noCatchUpFrames > 0) {
      this.noCatchUpFrames -= 1;
      this.simulationAccumulatorMs = 0;
      this.runSimulationStep(FIXED_STEP_MS);
      this.updateCameraAndHud(presentationDelta);
    } else {
      this.simulationAccumulatorMs += cappedDelta;
      let catchUpSteps = 0;
      while (
        this.simulationAccumulatorMs >= FIXED_STEP_MS &&
        catchUpSteps < MAX_CATCH_UP_STEPS
      ) {
        this.runSimulationStep(FIXED_STEP_MS);
        this.simulationAccumulatorMs -= FIXED_STEP_MS;
        catchUpSteps += 1;
      }
      if (catchUpSteps === MAX_CATCH_UP_STEPS) {
        this.simulationAccumulatorMs = 0;
      }
      this.updateCameraAndHud(presentationDelta);
    }

    if (this.matchEnded) {
      this.updateLobbyReturnUi();
    }

    if (!this.finishSent && !this.matchEnded && this.map?.isMatchFinished?.()) {
      this.finishSent = true;
      appAudioManager.handleGameLocalFinish();
      const stats = this.map?.getMatchStats?.(this.moto) || {};
      this.multiplayer?.emitFinishMatch(stats);
    }
  },
};
