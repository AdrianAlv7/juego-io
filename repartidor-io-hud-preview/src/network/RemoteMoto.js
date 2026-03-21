import Phaser from "phaser";

function hashColorFromId(id = "") {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }

  const hue = Math.abs(hash) % 360;
  const color = Phaser.Display.Color.HSLToColor(hue / 360, 0.65, 0.55);
  return color.color;
}

export default class RemoteMoto {
  constructor(scene, id, spriteKey, initialState) {
    this.scene = scene;
    this.id = id;

    this.sprite = scene.physics.add.sprite(
      initialState.x,
      initialState.y,
      spriteKey
    );
    this.sprite.setOrigin(0.5);
    this.sprite.setScale(0.15);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setDrag(200, 200);
    this.sprite.setTint(hashColorFromId(id));

    this.targetX = initialState.x;
    this.targetY = initialState.y;
    this.targetAngle = initialState.angle || 0;
  }

  applyServerState(nextState) {
    this.targetX = nextState.x;
    this.targetY = nextState.y;
    this.targetAngle = nextState.angle || 0;
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
