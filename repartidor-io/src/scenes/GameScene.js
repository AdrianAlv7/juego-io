import Phaser from "phaser";
import Moto from "../entities/moto.js";
import OpenMap from "../world/Map.js";
import TrackMap from "../world/TrackMap.js";
import InputSystem from "../systems/InputSystem.js";
import DebugHUD from "../ui/DebugHUD.js";

// Total world size.
const WORLD_WIDTH = 6000;
const WORLD_HEIGHT = 6000;

// Simple map modes for quick selection.
const MAP_OPEN = "open";
const MAP_TRACK = "track";
const DEFAULT_MAP_MODE = MAP_OPEN;

// Fixed simulation step keeps gameplay identical across 60/165/240 Hz displays.
const SIMULATION_FPS = 60;
const FIXED_STEP_MS = 1000 / SIMULATION_FPS;
const MAX_CATCH_UP_STEPS = 5;

// Protection against startup/resume hitches.
const STARTUP_STABILIZE_FRAMES = 8;
const RESUME_STABILIZE_FRAMES = 6;
const MAX_ACCUMULATED_DELTA_MS = 250;
const DELTA_SPIKE_RESET_MS = 90;
const CAMERA_DELTA_CAP_MS = 50;

// Camera tuning.
const CAMERA_BASE_ZOOM = 1;
const CAMERA_FAST_ZOOM = 0.9;
const CAMERA_LOOK_AHEAD_MAX = 110;
const ZOOM_DAMPING = 8;
const OFFSET_DAMPING = 10;

// Frame-rate independent damping helper.
function damp(current, target, dampingPerSecond, deltaMs) {
  const t = 1 - Math.exp((-dampingPerSecond * deltaMs) / 1000);
  return Phaser.Math.Linear(current, target, t);
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    // Selected map mode.
    this.mapMode = DEFAULT_MAP_MODE;

    // Camera offset state.
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;

    // Fixed-step accumulator.
    this.simulationAccumulatorMs = 0;

    // During stabilize frames we avoid catch-up loops to prevent initial stutter.
    this.noCatchUpFrames = STARTUP_STABILIZE_FRAMES;

    // Keep bound reference so we can remove listener on shutdown.
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  init(data) {
    // Accept map mode from scene restart payload.
    if (data?.mapMode === MAP_TRACK || data?.mapMode === MAP_OPEN) {
      this.mapMode = data.mapMode;
    } else {
      this.mapMode = DEFAULT_MAP_MODE;
    }
  }

  preload() {
    // Main player sprite.
    this.load.image("moto", "assets/moto.png");
  }

  create() {
    // Input and quick map selector (1/2).
    this.inputSystem = new InputSystem(this);
    this.mapOpenKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ONE
    );
    this.mapTrackKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.TWO
    );

    // Build world based on selected mode.
    this.map = this.createMapByMode(this.mapMode);
    const spawn = this.map.getSpawnPoint();

    // Create player at map spawn.
    this.moto = new Moto(this, spawn.x, spawn.y, this.inputSystem);

    // Camera setup.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.setZoom(CAMERA_BASE_ZOOM);
    cam.startFollow(this.moto.sprite, false, 1, 1);

    // Resize handling.
    this.handleResize(this.scale.gameSize);
    this.scale.on("resize", this.handleResize, this);

    // Visibility handling to avoid spikes after tab switches.
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.game.loop.resetDelta?.();

    // Cleanup listeners.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.handleResize, this);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    });

    // Debug HUD.
    this.hud = new DebugHUD(this);
  }

  createMapByMode(mode) {
    // Common options shared by every map type.
    const mapOptions = {
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    };

    // Picks map implementation by mode.
    if (mode === MAP_TRACK) {
      return new TrackMap(this, mapOptions);
    }
    return new OpenMap(this, mapOptions);
  }

  getMapLabel() {
    // Human-readable map label for HUD.
    if (this.mapMode === MAP_TRACK) return "Pista";
    return "Abierto";
  }

  onVisibilityChange() {
    // Always clear pending accumulated time.
    this.simulationAccumulatorMs = 0;
    this.game.loop.resetDelta?.();

    // When returning to visible state, run a few no-catch-up frames.
    if (!document.hidden) {
      this.noCatchUpFrames = RESUME_STABILIZE_FRAMES;
    }
  }

  handleResize(gameSize) {
    const cam = this.cameras.main;
    cam.setViewport(0, 0, gameSize.width, gameSize.height);
    cam.setDeadzone(
      Math.max(140, gameSize.width * 0.16),
      Math.max(100, gameSize.height * 0.14)
    );
  }

  restartWithMap(nextMode) {
    // Restarts scene with requested map mode.
    if (this.mapMode === nextMode) return false;
    this.scene.restart({ mapMode: nextMode });
    return true;
  }

  processMapSwitchInput() {
    // Number 1 => open map.
    if (Phaser.Input.Keyboard.JustDown(this.mapOpenKey)) {
      return this.restartWithMap(MAP_OPEN);
    }
    // Number 2 => track map.
    if (Phaser.Input.Keyboard.JustDown(this.mapTrackKey)) {
      return this.restartWithMap(MAP_TRACK);
    }
    return false;
  }

  updateCameraAndHud(deltaMs) {
    const cam = this.cameras.main;
    const speedRatio = Phaser.Math.Clamp(
      this.moto.speedPxPerSec / this.moto.maxSpeedPxPerSec,
      0,
      1
    );

    const targetZoom = Phaser.Math.Linear(
      CAMERA_BASE_ZOOM,
      CAMERA_FAST_ZOOM,
      speedRatio
    );
    cam.setZoom(damp(cam.zoom, targetZoom, ZOOM_DAMPING, deltaMs));

    const lookAheadDistance = CAMERA_LOOK_AHEAD_MAX * speedRatio;
    const targetOffsetX = Math.cos(this.moto.direction) * lookAheadDistance;
    const targetOffsetY = Math.sin(this.moto.direction) * lookAheadDistance;
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

    this.hud.update(this.moto, deltaMs, {
      mapLabel: this.getMapLabel(),
      mapHint: "1: Abierto | 2: Pista",
    });
  }

  update(_time, delta) {
    // Map switching is immediate.
    if (this.processMapSwitchInput()) return;

    // Cap extreme deltas from tab switching or debugger pauses.
    const cappedDelta = Math.min(delta, MAX_ACCUMULATED_DELTA_MS);
    const presentationDelta = Math.min(cappedDelta, CAMERA_DELTA_CAP_MS);

    // Large delta indicates a spike; drop accumulated catch-up.
    if (cappedDelta >= DELTA_SPIKE_RESET_MS) {
      this.simulationAccumulatorMs = 0;
      this.noCatchUpFrames = Math.max(
        this.noCatchUpFrames,
        RESUME_STABILIZE_FRAMES
      );
    }

    // First frames after boot/resume run one fixed step only.
    if (this.noCatchUpFrames > 0) {
      this.noCatchUpFrames -= 1;
      this.simulationAccumulatorMs = 0;
      this.moto.update(FIXED_STEP_MS);
      this.map.enforcePlayer(this.moto);
      this.updateCameraAndHud(presentationDelta);
      return;
    }

    // Standard fixed-step simulation with bounded catch-up.
    this.simulationAccumulatorMs += cappedDelta;
    let catchUpSteps = 0;
    while (
      this.simulationAccumulatorMs >= FIXED_STEP_MS &&
      catchUpSteps < MAX_CATCH_UP_STEPS
    ) {
      this.moto.update(FIXED_STEP_MS);
      this.map.enforcePlayer(this.moto);
      this.simulationAccumulatorMs -= FIXED_STEP_MS;
      catchUpSteps += 1;
    }

    // If still behind, discard remainder to avoid long hitch recovery.
    if (catchUpSteps === MAX_CATCH_UP_STEPS) {
      this.simulationAccumulatorMs = 0;
    }

    this.updateCameraAndHud(presentationDelta);
  }
}
