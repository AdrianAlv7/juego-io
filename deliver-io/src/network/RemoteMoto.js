import Phaser from "phaser";
import { getGarageMotoById } from "../garage/catalog.js";

function resolveMotoTextureKey(state = {}) {
  return getGarageMotoById(state?.motoId).textureKey;
}

function cloneObject(value, fallback = null) {
  if (!value || typeof value !== "object") return fallback;
  return { ...value };
}

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

export default class RemoteMoto {
  constructor(scene, id, initialState = {}) {
    this.scene = scene;
    this.id = id;
    this.motoId = getGarageMotoById(initialState?.motoId).id;

    this.sprite = scene.physics.add.sprite(
      initialState.x,
      initialState.y,
      resolveMotoTextureKey(initialState)
    );
    this.sprite.setOrigin(0.5);
    this.sprite.setScale(0.15);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setDrag(200, 200);
    this.refreshHitbox();

    this.targetX = initialState.x;
    this.targetY = initialState.y;
    this.targetAngle = initialState.angle || 0;
    this.progress = cloneObject(initialState.progress, null);
    this.hud = cloneObject(initialState.hud, null);
  }

  applyServerState(nextState = {}) {
    const nextMotoId = getGarageMotoById(nextState?.motoId).id;
    if (nextMotoId !== this.motoId) {
      this.motoId = nextMotoId;
      this.sprite.setTexture(resolveMotoTextureKey(nextState));
      this.refreshHitbox();
    }
    this.targetX = nextState.x;
    this.targetY = nextState.y;
    this.targetAngle = nextState.angle || 0;
    if (nextState.progress && typeof nextState.progress === "object") {
      this.progress = { ...nextState.progress };
    }
    if (nextState.hud && typeof nextState.hud === "object") {
      this.hud = { ...nextState.hud };
    }
  }

  refreshHitbox() {
    const radius =
      Math.min(this.sprite.displayWidth, this.sprite.displayHeight) * 0.35;
    this.sprite.body.setCircle(radius);
    this.sprite.body.setOffset(
      this.sprite.displayWidth / 2 - radius,
      this.sprite.displayHeight / 2 - radius
    );
  }

  update(delta = 16.7) {
    // Interpolacion suave de jugadores remotos.
    const t = Phaser.Math.Clamp((delta / 1000) * 14, 0, 1);
    const x = Phaser.Math.Linear(this.sprite.x, this.targetX, t);
    const y = Phaser.Math.Linear(this.sprite.y, this.targetY, t);
    this.sprite.setPosition(x, y);
    this.sprite.body.updateFromGameObject();
    const ghostActive = Boolean(this.hud?.moto?.ghost?.active);
    this.sprite.setAlpha(ghostActive ? 0.22 : 1);

    this.sprite.rotation = Phaser.Math.Angle.RotateTo(
      this.sprite.rotation,
      this.targetAngle,
      0.15
    );
  }

  getProgress() {
    return cloneObject(this.progress, null);
  }

  getHudSnapshot() {
    const hud = cloneObject(this.hud, null);
    if (!hud) return null;
    const inventory = cloneObject(hud.inventory, {});
    const inventoryItems = Array.isArray(inventory.items)
      ? inventory.items.map((entry) => ({ ...entry }))
      : [];
    inventory.items = inventoryItems;

    return {
      ...hud,
      delivery: cloneObject(hud.delivery, {}),
      timing: cloneObject(hud.timing, {}),
      moto: cloneObject(hud.moto, {}),
      inventory,
      stock: cloneObject(hud.stock, {}),
    };
  }

  isFinished() {
    return isProgressFinished(this.progress);
  }

  getSnapshot() {
    return {
      id: this.id,
      motoId: this.motoId,
      x: this.sprite.x,
      y: this.sprite.y,
      angle: this.sprite.rotation,
      progress: this.getProgress(),
      hud: this.getHudSnapshot(),
      finished: this.isFinished(),
    };
  }

  destroy() {
    this.sprite.destroy();
  }
}
