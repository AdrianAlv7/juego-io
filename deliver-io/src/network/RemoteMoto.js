import Phaser from "phaser";
import { getGarageMotoById } from "../garage/catalog.js";

function resolveMotoTextureKey(state = {}) {
  return getGarageMotoById(state?.motoId).textureKey;
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

    this.sprite.rotation = Phaser.Math.Angle.RotateTo(
      this.sprite.rotation,
      this.targetAngle,
      0.15
    );
  }

  destroy() {
    this.sprite.destroy();
  }
}
