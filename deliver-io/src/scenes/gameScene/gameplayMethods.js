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
  EARTHQUAKE_CAMERA_FX,
  ENGINE_VIBRATION_CAMERA_FX,
  MAX_ACCUMULATED_DELTA_MS,
  MAX_CATCH_UP_STEPS,
  OFFSET_DAMPING,
  RESUME_STABILIZE_FRAMES,
  SPECTATOR_START_DELAY_MS,
  TOP_SPEED_SCREEN_FX,
  WEATHER_OVERLAY_DAMPING,
  ZOOM_DAMPING,
  damp,
} from "./constants.js";

function isProgressFinished(progress = null) {
  if (!progress || typeof progress !== "object") return false;
  if (progress.finished === true) return true;

  const totalObjectives = Number(progress.totalObjectives || 0);
  const objectiveIndex = Number(progress.objectiveIndex || 0);
  const progressValue = Number(progress.progressValue || 0);

  if (Number.isFinite(totalObjectives) && totalObjectives > 0) {
    if (Number.isFinite(objectiveIndex) && objectiveIndex >= totalObjectives) {
      return true;
    }
    if (
      Number.isFinite(progressValue) &&
      progressValue >= totalObjectives * 1000000
    ) {
      return true;
    }
  }

  return false;
}

export const gameSceneGameplayMethods = {
  toggleFakeDepthBuildingsTest() {
    const next = this.collisionBuildingFakeDepthTest?.toggle?.();
    if (typeof next !== "boolean") return false;
    const count = Number(
      this.collisionBuildingFakeDepthTest?.getBuildingCount?.() || 0
    );
    const wallTextureReady = Boolean(this.textures?.exists?.("debug-wall-side"));
    const roofTextureReady = Boolean(this.textures?.exists?.("debug-roof-top"));
    const texStatus = `w:${wallTextureReady ? "ok" : "x"} r:${roofTextureReady ? "ok" : "x"}`;
    const onLabel = `FakeDepth test: ON (P) [${count}] ${texStatus}`;
    const offLabel = "FakeDepth test: OFF (P)";
    if (!this.usingGameplayHudKit && this.statusBanner) {
      this.statusBanner.setText(next ? onLabel : offLabel);
      this.statusBanner.setColor(next ? "#9be6b5" : "#ffd27d");
      this.statusBanner.setVisible(true);
    } else {
      this.hud?.queueBanner?.(
        next
          ? `FakeDepth ON [${count}] ${texStatus} (P)`
          : "FakeDepth OFF (P)",
        next ? "success" : "warning",
        900
      );
    }
    return next;
  },

  onWeatherEventQueued(payload = {}) {
    this.applyWeatherEventPayload(payload, "countdown");
  },

  onWeatherEventStarted(payload = {}) {
    this.applyWeatherEventPayload(payload, "active");
  },

  onWeatherEventEnded(payload = {}) {
    this.startEarthquakeFadeOut(payload.type || this.weatherEvent?.type);
    this.clearLocalWeatherEventState();
  },

  startEarthquakeFadeOut(type = this.weatherEvent?.type) {
    if (String(type || "") !== WEATHER_EVENT_TYPES.EARTHQUAKE) return;
    const fadeOutMs = Math.max(0, Number(EARTHQUAKE_CAMERA_FX.fadeOutMs || 0));
    if (fadeOutMs <= 0) return;
    this.earthquakeFadeStartedAtMs = this.time.now;
    this.earthquakeFadeUntilMs = this.earthquakeFadeStartedAtMs + fadeOutMs;
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
    if (payload.type === ITEM_TYPES.SHIELD) {
      if (
        this.shieldEffectSystem?.activate(
          this.map?.getMotoMaxHealth?.(),
          this.time.now
        )
      ) {
        if (!this.usingGameplayHudKit) {
          this.statusBanner.setText("Escudo activo");
          this.statusBanner.setColor("#7fe7ff");
          this.statusBanner.setVisible(true);
        }
      }
      return;
    }

    if (payload.type === ITEM_TYPES.GHOST) {
      const ghostDurationMs = Number(
        ITEM_CONFIG[ITEM_TYPES.GHOST]?.effectDurationMs || 2000
      );
      if (this.moto?.activateGhost?.({ durationMs: ghostDurationMs })) {
        this.hud?.queueBanner?.("Ghost activo", "info", 820);
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
    if (suppressed) {
      this.hud?.closeSettingsMenu?.({ silent: true });
    }
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
      cameraVibrationOverride: config.cameraVibrationOverride || null,
      source: payload.source || "",
    };
    if (phase === "active" && config.type === WEATHER_EVENT_TYPES.EARTHQUAKE) {
      this.earthquakeFadeStartedAtMs = 0;
      this.earthquakeFadeUntilMs = 0;
    }

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

  isSpectatorControlBlocked() {
    return Boolean(this.spectatorModeActive || this.spectatorPendingStartAtMs > 0);
  },

  getPlayerNameById(playerId) {
    if (!playerId) return "Jugador";
    const lobbyPlayers = Array.isArray(this.currentLobbyState?.players)
      ? this.currentLobbyState.players
      : [];
    const match = lobbyPlayers.find((player) => player.id === playerId);
    if (match?.name) return match.name;
    if (playerId === this.multiplayer?.selfId) return "Tu";
    return "Jugador";
  },

  getSpectatorPlayerIds() {
    const orderedIds = [];
    const pushUnique = (candidateId) => {
      if (!candidateId || orderedIds.includes(candidateId)) return;
      orderedIds.push(candidateId);
    };

    const lobbyPlayers = Array.isArray(this.currentLobbyState?.players)
      ? this.currentLobbyState.players
      : [];
    lobbyPlayers.forEach((player) => pushUnique(player.id));
    pushUnique(this.multiplayer?.selfId || "");
    (this.multiplayer?.getRemotePlayerStates?.() || []).forEach((player) =>
      pushUnique(player.id)
    );

    return orderedIds;
  },

  isPlayerFinishedById(playerId) {
    if (!playerId) return false;
    if (playerId === this.multiplayer?.selfId) {
      return Boolean(this.finishSent || this.map?.isMatchFinished?.());
    }

    const remoteSnapshot = this.multiplayer?.getRemotePlayerSnapshot?.(playerId);
    if (remoteSnapshot?.finished === true) return true;
    return isProgressFinished(remoteSnapshot?.progress);
  },

  getFallbackSpectatorTargetId(options = {}) {
    const { preferUnfinished = true, excludeId = "" } = options;
    const ids = this.getSpectatorPlayerIds();
    if (!ids.length) return "";

    const filtered = ids.filter((id) => id !== excludeId);
    if (!filtered.length) return "";

    if (preferUnfinished) {
      const unfinished = filtered.find((id) => !this.isPlayerFinishedById(id));
      if (unfinished) return unfinished;
    }

    const selfId = this.multiplayer?.selfId || "";
    if (selfId && filtered.includes(selfId)) return selfId;
    return filtered[0];
  },

  setSpectatorTarget(playerId, options = {}) {
    const { preferUnfinished = false, excludeId = "" } = options;
    const ids = this.getSpectatorPlayerIds();
    if (!ids.length) {
      this.spectatorTargetId = "";
      return "";
    }

    let nextTargetId = ids.includes(playerId) ? playerId : "";
    if (!nextTargetId) {
      nextTargetId = this.getFallbackSpectatorTargetId({
        preferUnfinished,
        excludeId,
      });
    }
    if (!nextTargetId) {
      nextTargetId = ids[0];
    }

    if (this.spectatorTargetId !== nextTargetId) {
      this.spectatorCameraTargetId = "";
    }
    this.spectatorTargetId = nextTargetId;
    this.spectatorTargetFinished = this.isPlayerFinishedById(nextTargetId);
    return nextTargetId;
  },

  selectNextSpectatorTarget(direction = 1) {
    if (!this.spectatorModeActive) return;

    const ids = this.getSpectatorPlayerIds();
    if (!ids.length) return;
    if (ids.length === 1) {
      this.setSpectatorTarget(ids[0]);
      return;
    }

    const step = direction >= 0 ? 1 : -1;
    const currentIndex = Math.max(0, ids.indexOf(this.spectatorTargetId));
    const nextIndex = (currentIndex + step + ids.length) % ids.length;
    this.setSpectatorTarget(ids[nextIndex]);
  },

  startSpectatorMode(options = {}) {
    const force = Boolean(options.force);
    if (!this.matchRunning || this.matchEnded) return false;
    if (!force && !this.finishSent) return false;
    if (this.spectatorModeActive) return true;

    const selfId = this.multiplayer?.selfId || "";
    const initialTargetId =
      this.getFallbackSpectatorTargetId({
        preferUnfinished: !force,
        excludeId: force ? "" : selfId,
      }) || this.getFallbackSpectatorTargetId({ preferUnfinished: false });

    if (!initialTargetId) return false;

    this.spectatorModeActive = true;
    this.spectatorPendingStartAtMs = 0;
    this.spectatorCameraTargetId = "";
    this.spectatorDebugOverride = force;
    this.setSpectatorTarget(initialTargetId);
    this.hud?.queueBanner?.("Modo espectador", "info", 900);
    return true;
  },

  stopSpectatorMode(options = {}) {
    const { restoreLocalCamera = false } = options;
    this.spectatorModeActive = false;
    this.spectatorPendingStartAtMs = 0;
    this.spectatorTargetId = "";
    this.spectatorCameraTargetId = "";
    this.spectatorTargetFinished = false;
    this.spectatorDebugOverride = false;

    if (restoreLocalCamera && this.moto?.sprite) {
      const cam = this.cameras.main;
      cam?.startFollow(this.moto.sprite, false, 1, 1);
      cam?.setFollowOffset(
        this.cameraOffsetX + (this.cameraEngineVibrationOffsetX || 0),
        this.cameraOffsetY + (this.cameraEngineVibrationOffsetY || 0)
      );
    }
  },

  handleSpectatorPlayerLeft(playerId) {
    if (!playerId) return;
    if (!this.spectatorModeActive) return;
    if (this.spectatorTargetId !== playerId) return;

    const replacement =
      this.getFallbackSpectatorTargetId({
        preferUnfinished: true,
        excludeId: playerId,
      }) ||
      this.getFallbackSpectatorTargetId({
        preferUnfinished: false,
        excludeId: playerId,
      });

    if (!replacement) {
      this.stopSpectatorMode({ restoreLocalCamera: true });
      return;
    }

    this.setSpectatorTarget(replacement);
  },

  toggleHostSpectatorMode() {
    if (!this.matchRunning || this.matchEnded) return;
    if (!this.isLocalHost?.()) return;

    if (this.spectatorModeActive && this.spectatorDebugOverride) {
      this.stopSpectatorMode({ restoreLocalCamera: true });
      this.hud?.queueBanner?.("Espectador test desactivado", "warning", 850);
      return;
    }

    if (this.startSpectatorMode({ force: true })) {
      this.hud?.queueBanner?.("Espectador test activado", "info", 850);
    }
  },

  grantHostDebugTurbo() {
    if (!this.matchRunning || this.matchEnded) return false;
    if (!this.isLocalHost?.()) return false;
    if (!this.positiveStockSystem?.grantDebugTurbo?.()) return false;
    this.refreshPositiveStockUi();
    return true;
  },

  forceHostDebugReachMeta() {
    if (!this.matchRunning || this.matchEnded) return false;
    if (!this.isLocalHost?.()) return false;
    if (this.finishSent) return false;

    const selfId = this.multiplayer?.selfId || "";
    if (!selfId) return false;

    const elapsedMs = Math.max(0, Number(this.map?.getElapsedRaceTimeMs?.() || 0));
    const elapsedSeconds = Math.max(0.1, elapsedMs / 1000);

    this.finishSent = true;
    this.spectatorModeActive = false;
    this.spectatorPendingStartAtMs = this.time.now + SPECTATOR_START_DELAY_MS;
    this.spectatorTargetId = "";
    this.spectatorCameraTargetId = "";
    this.spectatorTargetFinished = false;
    this.spectatorDebugOverride = false;

    appAudioManager.handleGameLocalFinish({ immediatePostFinish: true });
    this.multiplayer?.emitDebugSetFinishReport?.({
      playerId: selfId,
      qualityPercent: 100,
      elapsedSeconds,
      finalizeNow: false,
    });

    if (!this.usingGameplayHudKit) {
      this.statusBanner?.setText("Debug: meta forzada (host)");
      this.statusBanner?.setColor("#7fe7ff");
      this.statusBanner?.setVisible(true);
    }
    return true;
  },

  refreshSpectatorMode(nowMs = this.time.now) {
    if (!this.matchRunning || this.matchEnded) {
      if (this.spectatorModeActive || this.spectatorPendingStartAtMs > 0) {
        this.stopSpectatorMode({ restoreLocalCamera: true });
      }
      return;
    }

    const debugMode = Boolean(this.spectatorDebugOverride);
    if (!debugMode && !this.finishSent) {
      this.spectatorPendingStartAtMs = 0;
      return;
    }

    if (!this.spectatorModeActive) {
      if (debugMode) {
        this.startSpectatorMode({ force: true });
        return;
      }
      if (this.spectatorPendingStartAtMs <= 0) {
        this.spectatorPendingStartAtMs = nowMs + SPECTATOR_START_DELAY_MS;
      }
      if (nowMs >= this.spectatorPendingStartAtMs) {
        this.startSpectatorMode();
      }
      return;
    }

    if (!this.spectatorTargetId) {
      this.setSpectatorTarget(
        this.getFallbackSpectatorTargetId({ preferUnfinished: true })
      );
      return;
    }

    const isRemoteTarget = this.spectatorTargetId !== this.multiplayer?.selfId;
    if (
      isRemoteTarget &&
      !this.multiplayer?.getRemotePlayerSprite?.(this.spectatorTargetId)
    ) {
      this.handleSpectatorPlayerLeft(this.spectatorTargetId);
      return;
    }

    const targetFinished = this.isPlayerFinishedById(this.spectatorTargetId);
    const transitionedToFinished =
      targetFinished && this.spectatorTargetFinished === false;
    this.spectatorTargetFinished = targetFinished;
    if (!transitionedToFinished) return;

    const nextUnfinishedTarget = this.getFallbackSpectatorTargetId({
      preferUnfinished: true,
      excludeId: this.spectatorTargetId,
    });
    if (nextUnfinishedTarget && nextUnfinishedTarget !== this.spectatorTargetId) {
      this.setSpectatorTarget(nextUnfinishedTarget);
    }
  },

  buildHudSnapshotPayload(payload = {}) {
    const delivery = payload.delivery || {};
    const timing = payload.timing || {};
    const moto = payload.moto || {};
    const inventory = payload.inventory || {};
    const stock = payload.stock || {};

    const inventoryItems = Array.isArray(inventory.items)
      ? inventory.items.slice(0, 2).map((item, index) => ({
          slot: Number.isFinite(item?.slot) ? item.slot : index,
          type: item?.type || "",
          label: item?.label || "",
        }))
      : [];

    return {
      speedPxPerSec: Math.max(0, Number(payload.speedPxPerSec || 0)),
      maxSpeedPxPerSec: Math.max(0, Number(payload.maxSpeedPxPerSec || 0)),
      delivery: {
        currentOrder: Math.max(0, Number(delivery.currentOrder || 0)),
        totalOrders: Math.max(0, Number(delivery.totalOrders || 0)),
        destination: String(delivery.destination || ""),
        packageHealthPercent: Math.max(
          0,
          Math.min(100, Number(delivery.packageHealthPercent ?? 100))
        ),
        packageHealthColor: String(delivery.packageHealthColor || "#58d48f"),
        qualityPercent: Math.max(
          0,
          Math.min(100, Number(delivery.qualityPercent ?? 100))
        ),
        qualityColor: String(delivery.qualityColor || "#d6eaff"),
        deliveredCount: Math.max(0, Number(delivery.deliveredCount || 0)),
      },
      timing: {
        elapsedMs: Math.max(0, Number(timing.elapsedMs || 0)),
        countdownLabel: String(timing.countdownLabel || ""),
      },
      moto: {
        weatherEventType: String(moto.weatherEventType || WEATHER_EVENT_TYPES.NONE),
        healthPercent: Math.max(0, Math.min(100, Number(moto.healthPercent ?? 100))),
        healthColor: String(moto.healthColor || "#58d48f"),
        repairing: Boolean(moto.repairing),
        repairRemainingMs: Math.max(0, Number(moto.repairRemainingMs || 0)),
        turbo: {
          active: Boolean(moto.turbo?.active),
        },
        ghost: {
          active: Boolean(moto.ghost?.active),
        },
        heat: {
          active: Boolean(moto.heat?.active),
          percent: Phaser.Math.Clamp(Number(moto.heat?.percent || 0), 0, 1),
          cooling: Boolean(moto.heat?.cooling),
        },
      },
      inventory: {
        items: inventoryItems,
        maxItems: Math.max(0, Number(inventory.maxItems ?? 2)),
      },
      stock: {
        turboCharges: Math.max(0, Number(stock.turboCharges || 0)),
        turboMaxCharges: Math.max(1, Number(stock.turboMaxCharges || 3)),
      },
    };
  },

  getRemoteHudSnapshot(playerId) {
    const remoteSnapshot = this.multiplayer?.getRemotePlayerSnapshot?.(playerId);
    const remoteHud = remoteSnapshot?.hud || {};
    return this.buildHudSnapshotPayload({
      speedPxPerSec: remoteHud.speedPxPerSec,
      maxSpeedPxPerSec: remoteHud.maxSpeedPxPerSec,
      delivery: remoteHud.delivery,
      timing: remoteHud.timing,
      moto: remoteHud.moto,
      inventory: remoteHud.inventory,
      stock: remoteHud.stock,
    });
  },

  updateSpectatorCameraAndHud(deltaMs) {
    if (!this.moto || !this.hud || !this.map || !this.spectatorModeActive) return;

    const selfId = this.multiplayer?.selfId || "";
    let targetId =
      this.spectatorTargetId ||
      this.getFallbackSpectatorTargetId({ preferUnfinished: true });
    if (!targetId) {
      targetId = this.getFallbackSpectatorTargetId({ preferUnfinished: false });
    }
    if (!targetId) {
      this.stopSpectatorMode({ restoreLocalCamera: true });
      return;
    }

    this.setSpectatorTarget(targetId);
    const isLocalTarget = targetId === selfId;
    let targetSprite = isLocalTarget
      ? this.moto?.sprite
      : this.multiplayer?.getRemotePlayerSprite?.(targetId) || null;

    if (!targetSprite) {
      this.handleSpectatorPlayerLeft(targetId);
      return;
    }

    const cam = this.cameras.main;
    if (cam) {
      if (this.spectatorCameraTargetId !== targetId) {
        cam.startFollow(targetSprite, false, 1, 1);
        this.spectatorCameraTargetId = targetId;
      }
      cam.setFollowOffset(0, 0);
      this.cameraOffsetX = 0;
      this.cameraOffsetY = 0;
      this.cameraEngineVibrationOffsetX = 0;
      this.cameraEngineVibrationOffsetY = 0;
      cam.setZoom(
        damp(cam.zoom, CAMERA_ZOOM_SETTINGS.baseZoom, ZOOM_DAMPING, deltaMs)
      );
      this.map?.updateCameraDrivenDecor?.(cam);
    }

    if (this.hudCamera) {
      this.hudCamera.setZoom(
        damp(
          this.hudCamera.zoom,
          CAMERA_ZOOM_SETTINGS.hudBaseZoom,
          CAMERA_ZOOM_SETTINGS.hudDamping,
          deltaMs
        )
      );
    }

    this.syncNightVisionFocus(targetSprite);

    let hudSnapshot = null;
    if (isLocalTarget) {
      const mapHudInfo = this.map.getHudInfo?.(this.moto) || {};
      const motoHudInfo = {
        ...(mapHudInfo.moto || {}),
        ...(this.moto.getHudState?.() || {}),
      };
      this.refreshPositiveStockUi();
      hudSnapshot = this.buildHudSnapshotPayload({
        speedPxPerSec: this.moto.speedPxPerSec,
        maxSpeedPxPerSec: this.moto.maxSpeedPxPerSec,
        delivery: mapHudInfo.delivery,
        timing: mapHudInfo.timing,
        moto: motoHudInfo,
        inventory: this.itemInventoryState,
        stock: this.positiveStockSystem?.getHudState?.() || {},
      });
      this.latestLocalHudSnapshot = hudSnapshot;
    } else {
      hudSnapshot = this.getRemoteHudSnapshot(targetId);
    }

    const finishWindowRemainingMs = this.finishWindowEndsAtMs
      ? Math.max(0, this.finishWindowEndsAtMs - Date.now())
      : 0;

    const remotePlayers = this.multiplayer?.getRemotePlayerStates?.() || [];
    const minimapRemotePlayers = remotePlayers.filter(
      (player) => player.id && player.id !== targetId
    );
    if (!isLocalTarget && selfId && this.moto?.sprite) {
      minimapRemotePlayers.push({
        id: selfId,
        x: this.moto.sprite.x,
        y: this.moto.sprite.y,
        angle: this.moto.direction,
        motoId: this.selectedGarageMotoId,
      });
    }

    const hudMotoReference = isLocalTarget
      ? this.moto
      : {
          speedPxPerSec: Number(hudSnapshot.speedPxPerSec || 0),
          maxSpeedPxPerSec: Math.max(
            1,
            Number(hudSnapshot.maxSpeedPxPerSec || 0)
          ),
        };

    const targetFinished = this.isPlayerFinishedById(targetId);
    this.spectatorTargetFinished = targetFinished;
    const spectatorIds = this.getSpectatorPlayerIds();

    this.hud.update(hudMotoReference, deltaMs, {
      delivery: hudSnapshot.delivery,
      timing: {
        ...hudSnapshot.timing,
        countdownLabel: "",
        finishWindowRemainingMs,
      },
      moto: hudSnapshot.moto,
      inventory: hudSnapshot.inventory,
      stock: hudSnapshot.stock,
      weatherEvent: {
        ...(this.weatherEvent || {}),
      },
      minimap: {
        localPlayer: {
          x: targetSprite.x,
          y: targetSprite.y,
          angle: isLocalTarget ? this.moto.direction : targetSprite.rotation,
        },
        remotePlayers: minimapRemotePlayers,
        objective: this.map?.getMinimapTarget?.() || null,
      },
      match: {
        running: this.matchRunning,
        ended: this.matchEnded,
        lobbyReturnAtMs: this.lobbyReturnAtMs,
        isHost: this.isLocalHost(),
        spectatorActive: true,
      },
      resultText: this.matchResultText,
      spectator: {
        active: true,
        targetId,
        targetName: this.getPlayerNameById(targetId),
        targetFinished,
        canNavigate: spectatorIds.length > 1,
      },
    });
  },

  updateWeatherEvent(deltaMs) {
    if (
      this.weatherEvent.phase === "active" &&
      this.weatherEvent.type !== WEATHER_EVENT_TYPES.NONE &&
      Date.now() >= this.weatherEvent.endsAtMs
    ) {
      this.startEarthquakeFadeOut(this.weatherEvent.type);
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

  syncNightVisionFocus(focusSprite = null) {
    if (!this.nightVisionOverlay) return;
    const targetSprite = focusSprite || this.moto?.sprite;
    if (!targetSprite) return;

    const cam = this.cameras.main;
    if (!cam) return;

    cam.preRender();
    const worldView = cam.worldView;
    const screenX =
      ((targetSprite.x - worldView.x) / Math.max(1, worldView.width)) *
        cam.width +
      cam.x;
    const screenY =
      ((targetSprite.y - worldView.y) / Math.max(1, worldView.height)) *
        cam.height +
      cam.y;
    this.nightVisionOverlay.setFocus(screenX, screenY);
  },

  updateCameraAndHud(deltaMs) {
    if (!this.moto || !this.hud || !this.map) return;
    this.map?.setCountdownSuppressed?.(Boolean(this.spectatorModeActive));
    if (this.spectatorModeActive) {
      this.updateSpectatorCameraAndHud(deltaMs);
      return;
    }

    const cam = this.cameras.main;
    const speedRatio = Phaser.Math.Clamp(
      this.moto.speedPxPerSec / this.moto.maxSpeedPxPerSec,
      0,
      1
    );
    const speedKmh = speedPxPerSecToKmh(this.moto.speedPxPerSec);
    const settingsMenuOpen = Boolean(this.hud?.isSettingsMenuOpen?.());
    const localPlayerLocked =
      settingsMenuOpen ||
      this.spectatorModeActive ||
      this.spectatorPendingStartAtMs > 0 ||
      this.matchEnded ||
      (this.map.isPlayerLocked?.() ?? false) ||
      (this.map.isRiderRepairing?.() ?? false);
    appAudioManager.updateGameMoto({
      nowMs: this.time.now,
      deltaMs,
      speedKmh,
      accelerating:
        !localPlayerLocked &&
        Boolean(this.inputSystem?.up) &&
        !Boolean(this.inputSystem?.down),
      braking: Boolean(this.moto.isBraking),
      turboActive: Boolean(this.moto.turboState?.active),
      turboRemainingMs: Math.max(
        0,
        Number(this.moto.turboState?.untilMs || 0) - this.time.now
      ),
    });
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
    if (this.earthquakeFadeUntilMs > 0 && now >= this.earthquakeFadeUntilMs) {
      this.earthquakeFadeStartedAtMs = 0;
      this.earthquakeFadeUntilMs = 0;
    }
    const isEarthquakeActive =
      this.weatherEvent.phase === "active" &&
      this.weatherEvent.type === WEATHER_EVENT_TYPES.EARTHQUAKE;
    const earthquakeFadeRemainingMs = Math.max(
      0,
      Number(this.earthquakeFadeUntilMs || 0) - now
    );
    const isEarthquakeFading = !isEarthquakeActive && earthquakeFadeRemainingMs > 0;
    const earthquakeFadeDurationMs = Math.max(
      1,
      Number(this.earthquakeFadeUntilMs || 0) -
        Number(this.earthquakeFadeStartedAtMs || 0)
    );
    const earthquakeFadeLinear = isEarthquakeFading
      ? Phaser.Math.Clamp(earthquakeFadeRemainingMs / earthquakeFadeDurationMs, 0, 1)
      : 0;
    const earthquakeFadeStrength = Math.pow(earthquakeFadeLinear, 1.2);
    let vibrationTargetX = 0;
    let vibrationTargetY = 0;
    let vibrationDamping = ENGINE_VIBRATION_CAMERA_FX.damping;
    if (ENGINE_VIBRATION_CAMERA_FX.enabled) {
      const buildNormalVibration = () => {
        const vibrationOffset = this.moto.getEngineVibrationOffset?.() || {
          x: 0,
          y: 0,
        };
        const vibrationWeight = Phaser.Math.Linear(
          ENGINE_VIBRATION_CAMERA_FX.idleWeight,
          ENGINE_VIBRATION_CAMERA_FX.cruiseWeight,
          Math.pow(speedRatio, ENGINE_VIBRATION_CAMERA_FX.stabilizationPower)
        );
        const vibrationIntensity = Math.max(
          0,
          Number(ENGINE_VIBRATION_CAMERA_FX.intensity || 0)
        );
        const dynamicMaxOffsetX = Phaser.Math.Clamp(
          ENGINE_VIBRATION_CAMERA_FX.maxOffsetXPx *
            (1 +
              Math.max(0, vibrationIntensity - 1) *
                ENGINE_VIBRATION_CAMERA_FX.maxOffsetIntensityInfluence),
          ENGINE_VIBRATION_CAMERA_FX.maxOffsetXPx,
          ENGINE_VIBRATION_CAMERA_FX.maxOffsetCapXPx
        );
        const dynamicMaxOffsetY = Phaser.Math.Clamp(
          ENGINE_VIBRATION_CAMERA_FX.maxOffsetYPx *
            (1 +
              Math.max(0, vibrationIntensity - 1) *
                ENGINE_VIBRATION_CAMERA_FX.maxOffsetIntensityInfluence),
          ENGINE_VIBRATION_CAMERA_FX.maxOffsetYPx,
          ENGINE_VIBRATION_CAMERA_FX.maxOffsetCapYPx
        );
        const mixedOffsetX =
          Number(vibrationOffset.x || 0) +
          Number(vibrationOffset.y || 0) * ENGINE_VIBRATION_CAMERA_FX.crossAxisMix;
        const mixedOffsetY =
          Number(vibrationOffset.y || 0) +
          Number(vibrationOffset.x || 0) * ENGINE_VIBRATION_CAMERA_FX.crossAxisMix;
        return {
          x: Phaser.Math.Clamp(
            mixedOffsetX *
              ENGINE_VIBRATION_CAMERA_FX.axisXMultiplier *
              vibrationIntensity *
              vibrationWeight,
            -dynamicMaxOffsetX,
            dynamicMaxOffsetX
          ),
          y: Phaser.Math.Clamp(
            mixedOffsetY *
              ENGINE_VIBRATION_CAMERA_FX.axisYMultiplier *
              vibrationIntensity *
              vibrationWeight,
            -dynamicMaxOffsetY,
            dynamicMaxOffsetY
          ),
          damping: ENGINE_VIBRATION_CAMERA_FX.damping,
        };
      };
      const buildEarthquakeVibration = (strength = 1) => {
        // Terremoto: intensidad fija del evento, sin suma con la vibracion normal
        // y sin suavizado por velocidad.
        const fixedEventIntensity = Math.max(
          0,
          Number(
            EARTHQUAKE_CAMERA_FX.fixedIntensity ??
              EARTHQUAKE_CAMERA_FX.defaultIntensity
          )
        );
        const quakeIntensity = (fixedEventIntensity * strength) / 100;
        const waveX =
          Math.sin(now * EARTHQUAKE_CAMERA_FX.waveFreqX) +
          Math.sin(now * EARTHQUAKE_CAMERA_FX.waveFreqXSecondary) *
            EARTHQUAKE_CAMERA_FX.waveSecondaryWeight;
        const waveY =
          Math.cos(now * EARTHQUAKE_CAMERA_FX.waveFreqY) +
          Math.sin(now * EARTHQUAKE_CAMERA_FX.waveFreqYSecondary) *
            EARTHQUAKE_CAMERA_FX.waveSecondaryWeight;
        const microJitterX =
          Math.sin(now * EARTHQUAKE_CAMERA_FX.microJitterFreqX + 0.9) *
          EARTHQUAKE_CAMERA_FX.microJitterXPxAt100;
        const microJitterY =
          Math.cos(now * EARTHQUAKE_CAMERA_FX.microJitterFreqY + 2.4) *
          EARTHQUAKE_CAMERA_FX.microJitterYPxAt100;
        return {
          x: Phaser.Math.Clamp(
            (waveX * EARTHQUAKE_CAMERA_FX.waveAmplitudeXPxAt100 + microJitterX) *
              quakeIntensity,
            -EARTHQUAKE_CAMERA_FX.maxOffsetXPxAt100 * quakeIntensity,
            EARTHQUAKE_CAMERA_FX.maxOffsetXPxAt100 * quakeIntensity
          ),
          y: Phaser.Math.Clamp(
            (waveY * EARTHQUAKE_CAMERA_FX.waveAmplitudeYPxAt100 + microJitterY) *
              quakeIntensity,
            -EARTHQUAKE_CAMERA_FX.maxOffsetYPxAt100 * quakeIntensity,
            EARTHQUAKE_CAMERA_FX.maxOffsetYPxAt100 * quakeIntensity
          ),
          damping: EARTHQUAKE_CAMERA_FX.damping,
        };
      };

      if (isEarthquakeActive) {
        const quake = buildEarthquakeVibration(1);
        vibrationTargetX = quake.x;
        vibrationTargetY = quake.y;
        vibrationDamping = quake.damping;
      } else if (isEarthquakeFading) {
        const normal = buildNormalVibration();
        const quake = buildEarthquakeVibration(earthquakeFadeStrength);
        vibrationTargetX = Phaser.Math.Linear(
          normal.x,
          quake.x,
          earthquakeFadeStrength
        );
        vibrationTargetY = Phaser.Math.Linear(
          normal.y,
          quake.y,
          earthquakeFadeStrength
        );
        vibrationDamping = Phaser.Math.Linear(
          normal.damping,
          quake.damping,
          earthquakeFadeStrength
        );
      } else {
        const normal = buildNormalVibration();
        vibrationTargetX = normal.x;
        vibrationTargetY = normal.y;
        vibrationDamping = normal.damping;
      }
    }
    this.cameraEngineVibrationOffsetX = damp(
      Number(this.cameraEngineVibrationOffsetX || 0),
      vibrationTargetX,
      vibrationDamping,
      deltaMs
    );
    this.cameraEngineVibrationOffsetY = damp(
      Number(this.cameraEngineVibrationOffsetY || 0),
      vibrationTargetY,
      vibrationDamping,
      deltaMs
    );
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
<<<<<<< HEAD
    cam.setFollowOffset(this.cameraOffsetX, this.cameraOffsetY);
    this.map?.updateCameraDrivenDecor?.(cam);
=======
    cam.setFollowOffset(
      this.cameraOffsetX + this.cameraEngineVibrationOffsetX,
      this.cameraOffsetY + this.cameraEngineVibrationOffsetY
    );
>>>>>>> 4327a8cc656b12958617cdc24b5c05e6d1d2a361
    this.syncNightVisionFocus(this.moto?.sprite);
    const mapHudInfo = this.map.getHudInfo?.(this.moto) || {};
    this.refreshPositiveStockUi();
    const finishWindowRemainingMs = this.finishWindowEndsAtMs
      ? Math.max(0, this.finishWindowEndsAtMs - Date.now())
      : 0;
    const motoHudInfo = {
      ...(mapHudInfo.moto || {}),
      ...(this.moto.getHudState?.() || {}),
    };
    const localHudSnapshot = this.buildHudSnapshotPayload({
      speedPxPerSec: this.moto.speedPxPerSec,
      maxSpeedPxPerSec: this.moto.maxSpeedPxPerSec,
      delivery: mapHudInfo.delivery,
      timing: mapHudInfo.timing,
      moto: motoHudInfo,
      inventory: this.itemInventoryState,
      stock: this.positiveStockSystem?.getHudState?.() || {},
    });
    this.latestLocalHudSnapshot = localHudSnapshot;

    this.hud.update(this.moto, deltaMs, {
      delivery: localHudSnapshot.delivery,
      moto: localHudSnapshot.moto,
      timing: {
        ...localHudSnapshot.timing,
        finishWindowRemainingMs,
      },
      inventory: localHudSnapshot.inventory,
      stock: localHudSnapshot.stock,
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
        spectatorActive: false,
      },
      resultText: this.matchResultText,
      spectator: {
        active: false,
      },
    });
  },

  update(_time, delta) {
    this.multiplayer?.update(delta);
    this.empPulseVisual?.update();
    this.collisionDebugOverlay?.update?.();
    this.collisionBuildingFakeDepthTest?.update?.();
    if (
      this.fakeDepthBuildingsToggleKey &&
      Phaser.Input.Keyboard.JustDown(this.fakeDepthBuildingsToggleKey)
    ) {
      this.toggleFakeDepthBuildingsTest();
    }

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
    let settingsMenuOpen = Boolean(this.hud?.isSettingsMenuOpen?.());
    if (
      keyboardActive &&
      this.settingsMenuKey &&
      Phaser.Input.Keyboard.JustDown(this.settingsMenuKey)
    ) {
      this.hud?.toggleSettingsMenu?.();
      settingsMenuOpen = Boolean(this.hud?.isSettingsMenuOpen?.());
    }
    this.refreshSpectatorMode(this.time.now);
    const shouldSyncFinishMusic =
      Number(this.finishWindowEndsAtMs || 0) > 0 || this.matchEnded;
    if (shouldSyncFinishMusic) {
      const finishWindowRemainingMs = this.finishWindowEndsAtMs
        ? Math.max(0, this.finishWindowEndsAtMs - Date.now())
        : 0;
      appAudioManager.handleGameFinishWindowCountdown?.({
        remainingMs: finishWindowRemainingMs,
        endsAtMs: this.finishWindowEndsAtMs,
        localFinished: Boolean(
          this.matchEnded || this.finishSent || this.map?.isMatchFinished?.()
        ),
      });
    }
    const gameplayInputBlocked =
      settingsMenuOpen || this.isSpectatorControlBlocked();

    if (!gameplayInputBlocked) {
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
        Phaser.Input.Keyboard.JustDown(this.earthquakeEventKey)
      ) {
        this.multiplayer?.emitQueueWeatherEvent(WEATHER_EVENT_TYPES.EARTHQUAKE);
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
      if (
        keyboardActive &&
        this.isLocalHost() &&
        (Phaser.Input.Keyboard.JustDown(this.grantGhostKey) ||
          Phaser.Input.Keyboard.JustDown(this.grantGhostNumpadKey))
      ) {
        this.multiplayer?.emitGrantItem(ITEM_TYPES.GHOST);
      }
      if (keyboardActive && this.inputSystem?.isDropItemJustPressed?.()) {
        this.multiplayer?.emitDropItem();
      }
      if (keyboardActive && this.inputSystem?.isTurboJustPressed?.()) {
        if (this.positiveStockSystem?.useTurbo(this.moto)) {
          this.refreshPositiveStockUi();
          this.cameras.main.shake(140, 0.0022);
        }
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
        !settingsMenuOpen &&
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
      this.spectatorModeActive = false;
      this.spectatorPendingStartAtMs = this.time.now + SPECTATOR_START_DELAY_MS;
      this.spectatorTargetId = "";
      this.spectatorCameraTargetId = "";
      this.spectatorTargetFinished = false;
      this.spectatorDebugOverride = false;
      appAudioManager.handleGameLocalFinish();
      const stats = this.map?.getMatchStats?.(this.moto) || {};
      this.multiplayer?.emitFinishMatch(stats);
    }
  },
};
