import { createInventoryState } from "./catalog.js";

const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 176;
const BUTTON_WIDTH = 92;
const BUTTON_HEIGHT = 34;

export default class ItemInventoryPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = Number(options.depth || 2140);
    this.margin = Number(options.margin || 18);
    this.onGrantOil = options.onGrantOil || null;
    this.onGrantWall = options.onGrantWall || null;
    this.onGrantEmp = options.onGrantEmp || null;

    this.visible = false;
    this.hostControlsVisible = false;
    this.inventoryState = createInventoryState([]);
    this.layout = {
      x: this.margin,
      y: this.margin,
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
    };

    this.graphics = scene.add.graphics().setDepth(this.depth);
    this.graphics.setScrollFactor(0);
    this.titleText = this.createText("", 0, 0, "22px", "#f8fbff", "bold");
    this.dropHintText = this.createText("", 0, 0, "17px", "#d9e5f4");
    this.slotTexts = [0, 1].map(() =>
      this.createText("", 0, 0, "18px", "#ffffff")
    );
    this.hostHintText = this.createText("", 0, 0, "16px", "#ffd27d");

    this.buttons = [
      this.createButton("[6] Aceite", 0x1e1e1e, () => this.onGrantOil?.()),
      this.createButton("[7] Muro", 0x80592c, () => this.onGrantWall?.()),
      this.createButton("[8] PEM", 0x245c7a, () => this.onGrantEmp?.()),
    ];

    this.handleResize = this.handleResize.bind(this);
    scene.scale.on("resize", this.handleResize, this);

    this.getObjects().forEach((gameObject) => {
      gameObject.__isHudObject = true;
    });

    this.handleResize(scene.scale.gameSize);
    this.refresh();
    this.setVisible(false);
  }

  createText(text, x, y, fontSize, color, fontStyle = "normal") {
    const node = this.scene.add.text(x, y, text, {
      fontFamily: "Consolas, monospace",
      fontSize,
      fontStyle,
      color,
    });
    node.setScrollFactor(0);
    node.setDepth(this.depth + 1);
    return node;
  }

  createButton(label, fillColor, onClick) {
    const background = this.scene.add
      .rectangle(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, fillColor, 0.94)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 1)
      .setStrokeStyle(2, 0xffffff, 0.16);
    const text = this.scene.add.text(0, 0, label, {
      fontFamily: "Consolas, monospace",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(this.depth + 2);

    background.on("pointerdown", () => {
      if (!this.visible || !this.hostControlsVisible) return;
      onClick?.();
    });

    background.__isHudObject = true;
    text.__isHudObject = true;

    return { background, text };
  }

  handleResize(gameSize) {
    this.layout = {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      x: gameSize.width - PANEL_WIDTH - this.margin,
      y: gameSize.height - PANEL_HEIGHT - this.margin,
    };
    this.refreshLayout();
  }

  refreshLayout() {
    const { x, y, width } = this.layout;
    this.titleText.setPosition(x + 18, y + 14);
    this.dropHintText.setPosition(x + 18, y + 46);
    this.slotTexts[0].setPosition(x + 18, y + 78);
    this.slotTexts[1].setPosition(x + 18, y + 106);
    this.hostHintText.setPosition(x + 18, y + 140);

    const startX = x + width - 302;
    this.buttons.forEach((button, index) => {
      const buttonX = startX + index * 100;
      button.background.setPosition(buttonX, y + 132);
      button.text.setPosition(buttonX + 46, y + 149);
    });
    this.drawPanel();
  }

  drawPanel() {
    this.graphics.clear();
    if (!this.visible) return;

    const { x, y, width, height } = this.layout;
    this.graphics.fillStyle(0x0a1018, 0.92);
    this.graphics.fillRoundedRect(x, y, width, height, 18);
    this.graphics.lineStyle(2, 0xffffff, 0.14);
    this.graphics.strokeRoundedRect(x, y, width, height, 18);
  }

  buildSlotLabel(slotIndex) {
    const entry = this.inventoryState.items[slotIndex];
    if (!entry) return `Slot ${slotIndex + 1}: vacio`;
    const readyTag = slotIndex === 0 ? " | listo" : "";
    return `Slot ${slotIndex + 1}: ${entry.label}${readyTag}`;
  }

  refresh() {
    const itemCount = this.inventoryState.items.length;
    const maxItems = Number(this.inventoryState.maxItems || 2);
    this.titleText.setText(`Objetos ${itemCount}/${maxItems}`);
    this.dropHintText.setText("Soltar actual: [Z]");
    this.slotTexts[0].setText(this.buildSlotLabel(0));
    this.slotTexts[1].setText(this.buildSlotLabel(1));
    this.hostHintText.setText("Host debug negativos: [6]/[7]/[8]/[9]");
    this.refreshVisibility();
  }

  refreshVisibility() {
    this.drawPanel();

    const showBase = this.visible;
    this.titleText.setVisible(showBase);
    this.dropHintText.setVisible(showBase);
    this.slotTexts.forEach((node) => node.setVisible(showBase));

    const showHost = showBase && this.hostControlsVisible;
    this.hostHintText.setVisible(showHost);
    this.buttons.forEach((button) => {
      button.background.setVisible(showHost);
      button.text.setVisible(showHost);
      button.background.disableInteractive();
      if (showHost) {
        button.background.setInteractive({ useHandCursor: true });
      }
    });
  }

  setInventory(state = {}) {
    this.inventoryState = createInventoryState(
      Array.isArray(state.items)
        ? state.items.map((entry) => entry?.type).filter(Boolean)
        : []
    );
    this.refresh();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.refreshVisibility();
  }

  setHostControlsVisible(visible) {
    this.hostControlsVisible = Boolean(visible);
    this.refreshVisibility();
  }

  getObjects() {
    return [
      this.graphics,
      this.titleText,
      this.dropHintText,
      ...this.slotTexts,
      this.hostHintText,
      ...this.buttons.flatMap((button) => [button.background, button.text]),
    ].filter(Boolean);
  }

  destroy() {
    this.scene.scale.off("resize", this.handleResize, this);
    this.buttons.forEach((button) => {
      button.background.disableInteractive();
      button.background.destroy();
      button.text.destroy();
    });
    this.graphics.destroy();
    this.titleText.destroy();
    this.dropHintText.destroy();
    this.slotTexts.forEach((node) => node.destroy());
    this.hostHintText.destroy();
  }
}
