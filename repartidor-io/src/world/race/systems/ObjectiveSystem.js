import Phaser from "phaser";

function objectiveMessage(active, completedPairs) {
  if (!active) return "Objetivo: completado";
  if (active.kind === "pickup") {
    return `Objetivo: recoger ${active.label} (${active.orderNumber}/3)`;
  }
  if (active.kind === "dropoff") {
    return `Objetivo: entregar ${active.label} (${active.orderNumber}/3)`;
  }
  return `Objetivo: volver a BASE (${completedPairs}/3 pedidos)`;
}

function directionLabel(dx, dy) {
  const distance = Math.hypot(dx, dy);
  if (distance < 8) return "AQUI";
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const sectors = ["E", "NE", "N", "NO", "O", "SO", "S", "SE"];
  return sectors[Math.round(angle / 45) % sectors.length];
}

export default class ObjectiveSystem {
  constructor(scene, options) {
    this.scene = scene;
    this.basePoint = options.basePoint;
    this.orders = options.orders;
    this.totalOrders = this.orders.length;
    this.radii = options.radii;
    this.serviceTimeMs = options.serviceTimeMs;
    this.defaultEventDurationMs = options.defaultEventDurationMs;

    this.sequence = this.createSequence();
    this.currentIndex = 0;
    this.finished = false;
    this.finishTimeMs = 0;
    this.hasPackage = false;

    this.currentServiceIndex = -1;
    this.serviceStartMs = 0;
    this.serviceProgress = 0;
    this.serviceKind = "";
    this.serviceTargetLabel = "";

    this.createMarkers();
    this.createEventText();
    this.createFinishBanner();
    this.updateVisuals();

    this.handleResize(scene.scale.gameSize);
    scene.scale.on("resize", this.handleResize, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off("resize", this.handleResize, this);
    });
  }

  getOrderProgressData(moto) {
    if (this.finished) {
      return {
        currentOrder: this.totalOrders,
        totalOrders: this.totalOrders,
        destinationLabel: "BASE completada",
        phaseLabel: "Finalizada",
        distancePx: 0,
      };
    }

    const active = this.getCurrentObjective();
    if (!active) {
      return {
        currentOrder: 0,
        totalOrders: this.totalOrders,
        destinationLabel: "N/A",
        phaseLabel: "Sin objetivo",
        distancePx: 0,
      };
    }

    const currentOrder = active.orderNumber ?? this.totalOrders;
    let phaseLabel = "Regresar";
    if (active.kind === "pickup") phaseLabel = "Recoger";
    if (active.kind === "dropoff") phaseLabel = "Entregar";

    const distancePx = moto
      ? Math.round(
          Phaser.Math.Distance.Between(
            moto.sprite.x,
            moto.sprite.y,
            active.x,
            active.y
          )
        )
      : 0;

    return {
      currentOrder,
      totalOrders: this.totalOrders,
      destinationLabel: active.label,
      phaseLabel,
      distancePx,
    };
  }

  createSequence() {
    const sequence = [];
    for (let i = 0; i < this.orders.length; i += 1) {
      const order = this.orders[i];
      sequence.push({
        kind: "pickup",
        orderNumber: i + 1,
        radius: this.radii.pickupRadius,
        ...order.pickup,
      });
      sequence.push({
        kind: "dropoff",
        orderNumber: i + 1,
        radius: this.radii.dropoffRadius,
        ...order.dropoff,
      });
    }
    sequence.push({
      kind: "return",
      orderNumber: null,
      x: this.basePoint.x,
      y: this.basePoint.y,
      label: "BASE",
      color: 0x57cc99,
      radius: this.radii.returnRadius,
    });
    return sequence;
  }

  createMarkers() {
    this.markerNodes = [];
    for (const objective of this.sequence) {
      const zone = this.scene.add.circle(
        objective.x,
        objective.y,
        objective.radius,
        objective.color,
        0.2
      );
      zone.setStrokeStyle(4, objective.color, 0.9);
      zone.setDepth(-5);

      const label = this.scene.add.text(objective.x, objective.y, objective.label, {
        fontFamily: "Consolas",
        fontSize: "32px",
        color: "#ffffff",
        fontStyle: "bold",
      });
      label.setOrigin(0.5);
      label.setDepth(10);

      this.markerNodes.push({ zone, label, objective });
    }
  }

  createEventText() {
    this.eventHideAtMs = 0;
    this.eventText = this.scene.add.text(
      this.scene.scale.width / 2,
      this.scene.scale.height * 0.1,
      "",
      {
        fontFamily: "Consolas",
        fontSize: "34px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6,
        fontStyle: "bold",
      }
    );
    this.eventText.setOrigin(0.5);
    this.eventText.setScrollFactor(0);
    this.eventText.setDepth(1110);
    this.eventText.setVisible(false);
  }

  createFinishBanner() {
    this.finishBanner = this.scene.add.text(
      this.scene.scale.width / 2,
      this.scene.scale.height * 0.5,
      "MISION CUMPLIDA",
      {
        fontFamily: "Consolas",
        fontSize: "70px",
        color: "#57cc99",
        stroke: "#000000",
        strokeThickness: 10,
        fontStyle: "bold",
      }
    );
    this.finishBanner.setOrigin(0.5);
    this.finishBanner.setScrollFactor(0);
    this.finishBanner.setDepth(1120);
    this.finishBanner.setVisible(false);
  }

  handleResize(gameSize) {
    this.eventText.setPosition(gameSize.width / 2, gameSize.height * 0.1);
    this.finishBanner.setPosition(gameSize.width / 2, gameSize.height * 0.5);
  }

  showEventMessage(
    text,
    color = "#ffffff",
    durationMs = this.defaultEventDurationMs
  ) {
    this.eventText.setText(text);
    this.eventText.setColor(color);
    this.eventText.setVisible(true);
    this.eventHideAtMs =
      durationMs === null ? Number.POSITIVE_INFINITY : this.scene.time.now + durationMs;
  }

  hideExpiredEvent() {
    if (!this.eventText.visible) return;
    if (this.eventHideAtMs === Number.POSITIVE_INFINITY) return;
    if (this.scene.time.now < this.eventHideAtMs) return;
    this.eventText.setVisible(false);
  }

  getCurrentObjective() {
    return this.sequence[this.currentIndex] || null;
  }

  isFinished() {
    return this.finished;
  }

  isServingCurrentObjective() {
    return this.currentServiceIndex === this.currentIndex;
  }

  resetServiceState() {
    this.currentServiceIndex = -1;
    this.serviceStartMs = 0;
    this.serviceProgress = 0;
    this.serviceKind = "";
    this.serviceTargetLabel = "";
  }

  updateVisuals() {
    const active = this.getCurrentObjective();
    this.markerNodes.forEach((node, index) => {
      const isPast = index < this.currentIndex;
      const isActive = node.objective === active && !this.finished;

      node.zone.setAlpha(isActive ? 0.4 : isPast ? 0.12 : 0.06);
      node.zone.setStrokeStyle(
        4,
        node.objective.color,
        isActive ? 1 : isPast ? 0.6 : 0.35
      );
      node.label.setAlpha(isActive ? 1 : isPast ? 0.55 : 0.3);
    });
  }

  completeCurrentObjective(completed) {
    if (completed.kind === "pickup") this.hasPackage = true;
    if (completed.kind === "dropoff") this.hasPackage = false;

    this.resetServiceState();
    this.currentIndex += 1;
    const next = this.getCurrentObjective();

    if (this.currentIndex >= this.sequence.length) {
      this.finished = true;
      this.finishTimeMs = this.scene.time.now;
      this.finishBanner.setVisible(true);
      this.showEventMessage(
        "Ruta completada. Esperando resultado final...",
        "#a7ffb8",
        null
      );
      this.updateVisuals();
      return;
    }

    if (completed.kind === "pickup") {
      this.showEventMessage(`Recolecta ${completed.label} lista. Ve a ${next.label}`, "#ffd98a");
    } else if (completed.kind === "dropoff") {
      this.showEventMessage(`Entrega ${completed.label} completada. Ve a ${next.label}`, "#9cf5b8");
    }

    this.updateVisuals();
  }

  startServiceFor(target) {
    this.currentServiceIndex = this.currentIndex;
    this.serviceStartMs = this.scene.time.now;
    this.serviceProgress = 0;
    this.serviceKind = target.kind;
    this.serviceTargetLabel = target.label;
  }

  cancelServiceForCurrentObjective() {
    if (!this.isServingCurrentObjective()) return;
    this.resetServiceState();
    this.showEventMessage("Operacion cancelada: vuelve al punto", "#ff9f9f", 1100);
  }

  updateServiceFor(target) {
    if (!this.isServingCurrentObjective()) {
      this.startServiceFor(target);
    }

    const elapsed = this.scene.time.now - this.serviceStartMs;
    this.serviceProgress = Phaser.Math.Clamp(elapsed / this.serviceTimeMs, 0, 1);
    const verb = this.serviceKind === "pickup" ? "Recogiendo" : "Entregando";
    const percent = Math.round(this.serviceProgress * 100);
    this.showEventMessage(
      `${verb} ${target.label}... ${percent}%`,
      "#d5e7ff",
      null
    );
    if (this.serviceProgress < 1) return;

    this.completeCurrentObjective(target);
  }

  advanceProgress(moto) {
    if (this.finished) return;
    const target = this.getCurrentObjective();
    if (!target) return;

    const distance = Phaser.Math.Distance.Between(
      moto.sprite.x,
      moto.sprite.y,
      target.x,
      target.y
    );
    const insideTargetZone = distance <= target.radius;
    const needsService = target.kind === "pickup" || target.kind === "dropoff";

    if (!insideTargetZone) {
      this.cancelServiceForCurrentObjective();
      return;
    }

    if (!needsService) {
      this.completeCurrentObjective(target);
      return;
    }

    this.updateServiceFor(target);
  }

  update(moto, isLocked) {
    this.hideExpiredEvent();
    if (isLocked) {
      this.resetServiceState();
      return;
    }
    this.advanceProgress(moto);
  }

  getObjectiveText(isLocked, countdownLabel) {
    if (this.finished) return "Objetivo: carrera terminada";
    if (isLocked) return `Salida: ${countdownLabel || "..."}`;

    const active = this.getCurrentObjective();
    if (active && this.isServingCurrentObjective()) {
      const verb = this.serviceKind === "pickup" ? "Recogiendo" : "Entregando";
      const percent = Math.round(this.serviceProgress * 100);
      return `Objetivo: ${verb.toLowerCase()} ${active.label} (${percent}%)`;
    }

    return objectiveMessage(active, Math.floor(this.currentIndex / 2));
  }

  getNextStopText(moto) {
    if (this.finished) return "Siguiente: carrera finalizada";
    const active = this.getCurrentObjective();
    if (!active || !moto) return "Siguiente: N/A";

    const dx = active.x - moto.sprite.x;
    const dy = active.y - moto.sprite.y;
    const distance = Math.round(Math.hypot(dx, dy));
    return `Siguiente: ${active.label} | ${distance}px | ${directionLabel(dx, dy)}`;
  }

  getCargoHudText() {
    if (this.finished) return "Carga: entregas completas";
    if (this.isServingCurrentObjective()) {
      const verb = this.serviceKind === "pickup" ? "recogiendo" : "entregando";
      const percent = Math.round(this.serviceProgress * 100);
      return `Carga: ${verb} ${this.serviceTargetLabel} (${percent}%)`;
    }
    return this.hasPackage ? "Carga: pedido a bordo" : "Carga: sin pedido";
  }

  getRiderState() {
    return {
      hasPackage: this.hasPackage,
      isServing: this.isServingCurrentObjective(),
      serviceKind: this.serviceKind,
      serviceProgress: this.serviceProgress,
      serviceLabel: this.serviceTargetLabel,
      finished: this.finished,
    };
  }
}
