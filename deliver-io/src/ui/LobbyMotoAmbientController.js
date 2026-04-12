import { GARAGE_MOTOS } from "../garage/catalog.js";

const REGULAR_PASS_TRACKS = new Set(["drop1", "drop2", "end"]);
const DONUT_TRACK = "dropInsano";
const CROSS_TRACK = "intermedio";
// Sube o baja este tope si quieres mas o menos trafico simultaneo en tracks normales.
const MAX_REGULAR_ACTORS = 4;
// Si la punta de la moto no queda mirando a la direccion correcta, ajusta este offset.
const SPRITE_HEADING_OFFSET_DEG = 0;
// dropInsano vive mejor si las motos quedan "abrazando" el UI en las esquinas.
// Mueve estos ratios si quieres acercarlas mas al centro o pegarlas mas al borde.
const INSANO_CORNER_ANCHORS = [
  { key: "tl", xRatio: 0.16, yRatio: 0.23, spinDirection: -1, baseAngleDeg: -12 },
  { key: "tr", xRatio: 0.84, yRatio: 0.25, spinDirection: 1, baseAngleDeg: 10 },
  { key: "bl", xRatio: 0.15, yRatio: 0.8, spinDirection: 1, baseAngleDeg: 14 },
  { key: "br", xRatio: 0.87, yRatio: 0.82, spinDirection: -1, baseAngleDeg: -8 },
];
// Este bloque imita la sensacion del Moto real al mantener "arriba + giro + drift":
// radio cerrado, poca correccion lateral y nariz adelantada hacia dentro de la curva.
// Toca estos valores si quieres un donut mas amplio, mas rapido o mas agresivo.
const INSANO_DRIFT_CIRCLE = Object.freeze({
  radiusPx: { min: 58, max: 74 },
  entryDurationMs: { min: 620, max: 920 },
  visualSpeedPxPerSec: { min: 320, max: 380 },
  headingLeadDeg: { min: 18, max: 26 },
  idleBobPx: { x: 6, y: 5 },
});
// Salida del modo insano:
// overflowPx define cuanto nos pasamos del borde al escapar; outwardBlend empuja un poco
// hacia afuera para que el escape se vea natural y no se meta al centro.
const INSANO_EXIT_VECTOR = Object.freeze({
  overflowPx: 240,
  durationMs: { min: 760, max: 980 },
  outwardBlend: 0.36,
});
// Durante dropInsano, las dos motos restantes cruzan el centro de una en una:
// una horizontal y otra vertical, con delay suficiente para que no se sature.
const INSANO_SUPPORT_PASS = Object.freeze({
  durationMs: { min: 420, max: 560 },
  delayMs: { min: 1800, max: 2800 },
  initialDelayMs: { min: 950, max: 1450 },
  horizontalYRatio: { min: 0.44, max: 0.56 },
  verticalXRatio: { min: 0.46, max: 0.54 },
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandom(items) {
  if (!Array.isArray(items) || !items.length) return null;
  return items[Math.floor(Math.random() * items.length)] || null;
}

function shuffle(items) {
  const copy = Array.isArray(items) ? items.slice() : [];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return copy;
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function easeInOutSine(progress) {
  return -(Math.cos(Math.PI * progress) - 1) / 2;
}

function easeOutCubic(progress) {
  return 1 - (1 - progress) ** 3;
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getAngleDeg(from, to, extraOffsetDeg = 0) {
  const dx = Number(to?.x || 0) - Number(from?.x || 0);
  const dy = Number(to?.y || 0) - Number(from?.y || 0);
  return (Math.atan2(dy, dx) * 180) / Math.PI + SPRITE_HEADING_OFFSET_DEG + extraOffsetDeg;
}

function createHorizontalPass(bounds, fromRight, yRatio) {
  const overflowX = Math.max(160, bounds.width * 0.12);
  const y = bounds.height * yRatio;
  return {
    start: { x: fromRight ? bounds.width + overflowX : -overflowX, y },
    end: { x: fromRight ? -overflowX : bounds.width + overflowX, y },
  };
}

function createVerticalPass(bounds, fromBottom, xRatio) {
  const overflowY = Math.max(150, bounds.height * 0.12);
  const x = bounds.width * xRatio;
  return {
    start: { x, y: fromBottom ? bounds.height + overflowY : -overflowY },
    end: { x, y: fromBottom ? -overflowY : bounds.height + overflowY },
  };
}

function createDiagonalPass(bounds, fromCorner, toCorner) {
  const overflowX = Math.max(150, bounds.width * 0.1);
  const overflowY = Math.max(120, bounds.height * 0.1);
  const corners = {
    tl: { x: -overflowX, y: -overflowY },
    tr: { x: bounds.width + overflowX, y: -overflowY },
    bl: { x: -overflowX, y: bounds.height + overflowY },
    br: { x: bounds.width + overflowX, y: bounds.height + overflowY },
  };
  return {
    start: corners[fromCorner],
    end: corners[toCorner],
  };
}

function getCirclePoint(centerX, centerY, radiusPx, angleRad) {
  return {
    x: centerX + Math.cos(angleRad) * radiusPx,
    y: centerY + Math.sin(angleRad) * radiusPx,
  };
}

function getApproachHeading(side) {
  if (side === "left") return 0;
  if (side === "right") return Math.PI;
  if (side === "top") return Math.PI / 2;
  return -Math.PI / 2;
}

function createOffscreenApproach(bounds, side, target) {
  const overflowX = Math.max(160, bounds.width * 0.12);
  const overflowY = Math.max(140, bounds.height * 0.12);
  if (side === "left") {
    return { x: -overflowX, y: clamp(target.y + randomBetween(-90, 90), -overflowY, bounds.height + overflowY) };
  }
  if (side === "right") {
    return {
      x: bounds.width + overflowX,
      y: clamp(target.y + randomBetween(-90, 90), -overflowY, bounds.height + overflowY),
    };
  }
  if (side === "top") {
    return { x: clamp(target.x + randomBetween(-110, 110), -overflowX, bounds.width + overflowX), y: -overflowY };
  }
  return {
    x: clamp(target.x + randomBetween(-110, 110), -overflowX, bounds.width + overflowX),
    y: bounds.height + overflowY,
  };
}

function normalizeVector(x, y, fallbackX = 1, fallbackY = 0) {
  const length = Math.hypot(x, y);
  if (length <= 0.0001) {
    const fallbackLength = Math.hypot(fallbackX, fallbackY) || 1;
    return { x: fallbackX / fallbackLength, y: fallbackY / fallbackLength };
  }
  return { x: x / length, y: y / length };
}

function projectToOffscreenPoint(bounds, start, direction, overflowPx = 220) {
  const dir = normalizeVector(direction.x, direction.y);
  const distances = [];

  if (dir.x > 0.0001) distances.push((bounds.width + overflowPx - start.x) / dir.x);
  if (dir.x < -0.0001) distances.push((-overflowPx - start.x) / dir.x);
  if (dir.y > 0.0001) distances.push((bounds.height + overflowPx - start.y) / dir.y);
  if (dir.y < -0.0001) distances.push((-overflowPx - start.y) / dir.y);

  const distance =
    distances.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b)[0] ??
    overflowPx;

  return {
    x: start.x + dir.x * distance,
    y: start.y + dir.y * distance,
  };
}

const REGULAR_PATTERNS = [
  {
    key: "lr-upper",
    directionGroup: "east",
    entryZone: "left-upper",
    exitZone: "right-upper",
    create(bounds) {
      return {
        ...createHorizontalPass(bounds, false, randomBetween(0.22, 0.32)),
        duration: randomBetween(1900, 2700),
        arc: 0,
      };
    },
  },
  {
    key: "rl-lower",
    directionGroup: "west",
    entryZone: "right-lower",
    exitZone: "left-lower",
    create(bounds) {
      return {
        ...createHorizontalPass(bounds, true, randomBetween(0.66, 0.8)),
        duration: randomBetween(1900, 2700),
        arc: 0,
      };
    },
  },
  {
    key: "lr-mid",
    directionGroup: "east",
    entryZone: "left-mid",
    exitZone: "right-mid",
    create(bounds) {
      return {
        ...createHorizontalPass(bounds, false, randomBetween(0.44, 0.56)),
        duration: randomBetween(2050, 2850),
        arc: 0,
      };
    },
  },
  {
    key: "rl-upper",
    directionGroup: "west",
    entryZone: "right-upper",
    exitZone: "left-upper",
    create(bounds) {
      return {
        ...createHorizontalPass(bounds, true, randomBetween(0.2, 0.34)),
        duration: randomBetween(2050, 2850),
        arc: 0,
      };
    },
  },
  {
    key: "tb-left",
    directionGroup: "south",
    entryZone: "top-left",
    exitZone: "bottom-left",
    create(bounds) {
      return {
        ...createVerticalPass(bounds, false, randomBetween(0.18, 0.3)),
        duration: randomBetween(2100, 3000),
        arc: 0,
      };
    },
  },
  {
    key: "bt-right",
    directionGroup: "north",
    entryZone: "bottom-right",
    exitZone: "top-right",
    create(bounds) {
      return {
        ...createVerticalPass(bounds, true, randomBetween(0.7, 0.82)),
        duration: randomBetween(2100, 3000),
        arc: 0,
      };
    },
  },
  {
    key: "tl-br",
    directionGroup: "south-east",
    entryZone: "top-left",
    exitZone: "bottom-right",
    create(bounds) {
      return {
        ...createDiagonalPass(bounds, "tl", "br"),
        duration: randomBetween(2100, 3000),
        arc: 0,
      };
    },
  },
  {
    key: "br-tl",
    directionGroup: "north-west",
    entryZone: "bottom-right",
    exitZone: "top-left",
    create(bounds) {
      return {
        ...createDiagonalPass(bounds, "br", "tl"),
        duration: randomBetween(2100, 3000),
        arc: 0,
      };
    },
  },
  {
    key: "tr-bl",
    directionGroup: "south-west",
    entryZone: "top-right",
    exitZone: "bottom-left",
    create(bounds) {
      return {
        ...createDiagonalPass(bounds, "tr", "bl"),
        duration: randomBetween(2100, 3000),
        arc: 0,
      };
    },
  },
  {
    key: "bl-tr",
    directionGroup: "north-east",
    entryZone: "bottom-left",
    exitZone: "top-right",
    create(bounds) {
      return {
        ...createDiagonalPass(bounds, "bl", "tr"),
        duration: randomBetween(2100, 3000),
        arc: 0,
      };
    },
  },
];

const CROSS_PATTERNS = [
  { key: "x-tl-br", fromCorner: "tl", toCorner: "br" },
  { key: "x-br-tl", fromCorner: "br", toCorner: "tl" },
  { key: "x-tr-bl", fromCorner: "tr", toCorner: "bl" },
  { key: "x-bl-tr", fromCorner: "bl", toCorner: "tr" },
];

export default class LobbyMotoAmbientController {
  // Controla las motos decorativas del lobby usando solo DOM:
  // - mt09 dispara una pasada rapida horizontal.
  // - drop1/drop2/end usan trafico suelto.
  // - dropInsano deja 4 motos grandes en las esquinas girando sobre si mismas.
  // - intermedio lanza cruces en X desde las esquinas.
  constructor(root) {
    this.root = root || null;
    this.wrapNode = this.root?.querySelector?.(".lhl-wrap") || null;
    this.layer = null;
    this.actors = new Set();
    this.recentMotoIds = [];
    this.currentMode = "idle";
    this.currentTrackState = {
      primaryLabel: "",
      overlayLabel: "",
      primarySource: "",
      overlaySource: "",
    };
    this.modeTimerId = 0;
    this.modeAuxTimerId = 0;
    this.rafId = 0;
    this.lastTrafficPatternKey = "";
    this.lastTrafficDirectionGroup = "";
    this.lastMt09DirectionKey = "";
    this.insanoSupportMotos = [];
    this.insanoSupportPassIndex = 0;
    this.frameStep = this.frameStep.bind(this);

    if (!this.root) return;

    this.layer = document.createElement("div");
    this.layer.className = "lhl-moto-ambient-layer";
    this.layer.setAttribute("aria-hidden", "true");
    if (this.wrapNode?.parentElement === this.root) {
      this.root.insertBefore(this.layer, this.wrapNode);
    } else {
      this.root.appendChild(this.layer);
    }
  }

  destroy() {
    this.clearProgramTimers();
    this.stopLoop();
    this.removeActors(() => true);
    this.layer?.remove?.();
    this.layer = null;
    this.root = null;
    this.wrapNode = null;
  }

  setTrackState(state = {}) {
    const nextState = {
      primaryLabel: String(state.primaryLabel || ""),
      overlayLabel: String(state.overlayLabel || ""),
      primarySource: String(state.primarySource || ""),
      overlaySource: String(state.overlaySource || ""),
    };
    const previousState = this.currentTrackState;
    this.currentTrackState = nextState;

    if (
      nextState.overlayLabel === "mt09" &&
      nextState.overlayLabel !== previousState.overlayLabel
    ) {
      this.spawnMt09Pass();
    }

    const nextMode = this.resolveMode(nextState.primaryLabel);
    if (nextMode !== this.currentMode) {
      this.applyMode(nextMode);
    }
  }

  resolveMode(trackLabel) {
    if (REGULAR_PASS_TRACKS.has(trackLabel)) return "regular";
    if (trackLabel === DONUT_TRACK) return "donut";
    if (trackLabel === CROSS_TRACK) return "cross";
    return "idle";
  }

  clearProgramTimers() {
    if (this.modeTimerId) {
      window.clearTimeout(this.modeTimerId);
      this.modeTimerId = 0;
    }
    if (this.modeAuxTimerId) {
      window.clearTimeout(this.modeAuxTimerId);
      this.modeAuxTimerId = 0;
    }
  }

  getBounds() {
    const width = this.layer?.clientWidth || this.root?.clientWidth || window.innerWidth || 1280;
    const height =
      this.layer?.clientHeight || this.root?.clientHeight || window.innerHeight || 720;
    return { width, height };
  }

  countActors(role) {
    let total = 0;
    this.actors.forEach((actor) => {
      if (actor.role === role) {
        total += 1;
      }
    });
    return total;
  }

  pickMotoBatch(count, blockedIds = []) {
    const blockedSet = new Set(blockedIds);
    const recentSet = new Set(this.recentMotoIds.slice(0, 3));

    let pool = GARAGE_MOTOS.filter(
      (moto) => !blockedSet.has(moto.id) && !recentSet.has(moto.id)
    );
    if (pool.length < count) {
      pool = GARAGE_MOTOS.filter((moto) => !blockedSet.has(moto.id));
    }
    if (pool.length < count) {
      pool = GARAGE_MOTOS.slice();
    }

    const picked = shuffle(pool).slice(0, Math.max(0, count));
    if (picked.length) {
      const nextRecent = picked.map((moto) => moto.id);
      this.recentMotoIds = nextRecent
        .concat(this.recentMotoIds.filter((id) => !nextRecent.includes(id)))
        .slice(0, GARAGE_MOTOS.length);
    }
    return picked;
  }

  createActorNode(moto, role, extraClass = "") {
    const node = document.createElement("img");
    node.className = `lhl-moto-ambient-bike ${extraClass}`.trim();
    node.src = moto.previewSrc;
    node.alt = "";
    node.draggable = false;
    node.decoding = "async";
    node.loading = "eager";
    node.dataset.role = role;
    return node;
  }

  ensureLoop() {
    if (this.rafId || !this.actors.size) return;
    this.rafId = window.requestAnimationFrame(this.frameStep);
  }

  stopLoop() {
    if (!this.rafId) return;
    window.cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  frameStep(frameNow) {
    this.rafId = 0;
    const bounds = this.getBounds();
    const actors = Array.from(this.actors);
    actors.forEach((actor) => {
      if (actor.kind === "motion") {
        const progress = (frameNow - actor.startedAt) / actor.duration;
        if (progress >= 1) {
          this.removeActor(actor);
          return;
        }
        actor.render(bounds, clamp(progress, 0, 1));
        return;
      }

      if (actor.kind === "drift-circle") {
        actor.render(bounds, frameNow);
      }
    });

    if (this.actors.size) {
      this.rafId = window.requestAnimationFrame(this.frameStep);
    }
  }

  removeActor(actor) {
    if (!actor) return;
    this.actors.delete(actor);
    actor.node?.remove?.();
  }

  removeActors(predicate) {
    Array.from(this.actors).forEach((actor) => {
      if (predicate(actor)) {
        this.removeActor(actor);
      }
    });
  }

  createMotionActor(config) {
    if (!this.layer || !config?.moto) return;

    const node = this.createActorNode(config.moto, config.role, config.className);
    this.layer.appendChild(node);

    const scale = Number(config.scale || 1);
    const arc = Number(config.arc || 0);
    const opacity = clamp(config.opacity ?? 0.92, 0.3, 1);
    const easing = typeof config.easing === "function" ? config.easing : easeInOutSine;
    const angleDeg = getAngleDeg(config.start, config.end, Number(config.angleOffsetDeg || 0));

    const actor = {
      kind: "motion",
      role: config.role,
      node,
      motoId: config.moto.id,
      patternKey: String(config.patternKey || ""),
      directionGroup: String(config.directionGroup || ""),
      entryZone: String(config.entryZone || ""),
      exitZone: String(config.exitZone || ""),
      startedAt: nowMs(),
      duration: Math.max(120, Number(config.duration || 1000)),
      render: (_bounds, rawProgress) => {
        // start/end ya definen el vector real del viaje; asi evitamos motos "chuecas"
        // y las dibujamos apuntando exactamente hacia donde se desplazan.
        const progress = easing(rawProgress);
        const x = lerp(config.start.x, config.end.x, progress);
        const y = lerp(config.start.y, config.end.y, progress) + Math.sin(progress * Math.PI) * arc;
        const fade = rawProgress < 0.08 ? rawProgress / 0.08 : 1;
        actor.currentX = x;
        actor.currentY = y;
        actor.currentHeadingDeg = angleDeg;
        actor.currentScale = scale;
        node.style.opacity = String(clamp(opacity * fade, 0, opacity));
        node.style.transform =
          `translate(${x}px, ${y}px) translate(-50%, -50%) ` +
          `rotate(${angleDeg}deg) scale(${scale})`;
      },
    };

    this.actors.add(actor);
    this.ensureLoop();
  }

  createSpinActor(config) {
    if (!this.layer || !config?.moto) return;

    const node = this.createActorNode(config.moto, "donut", "is-donut");
    this.layer.appendChild(node);

    const actor = {
      kind: "drift-circle",
      role: "donut",
      node,
      motoId: config.moto.id,
      render: (bounds, frameNow) => {
        const elapsedSec = (frameNow - actor.startedAt) / 1000;
        const centerX = bounds.width * config.anchorXRatio;
        const centerY = bounds.height * config.anchorYRatio;
        const elapsedMs = frameNow - actor.startedAt;
        if (elapsedMs < config.entryDurationMs) {
          const progress = easeOutCubic(clamp(elapsedMs / config.entryDurationMs, 0, 1));
          const x = lerp(config.entryStart.x, config.entryEnd.x, progress);
          const y = lerp(config.entryStart.y, config.entryEnd.y, progress);
          const approachAngleDeg = getAngleDeg(config.entryStart, config.entryEnd);
          actor.currentX = x;
          actor.currentY = y;
          actor.currentHeadingDeg = approachAngleDeg;
          actor.currentScale = config.scale;
          node.style.opacity = String(clamp(progress / 0.22, 0, 0.9));
          node.style.transform =
            `translate(${x}px, ${y}px) translate(-50%, -50%) ` +
            `rotate(${approachAngleDeg}deg) scale(${config.scale})`;
          return;
        }

        // Los anchors son porcentajes de pantalla: toca anchorXRatio/anchorYRatio
        // para recolocar la dona; radiusPx / visualSpeedPxPerSec alteran lo cerrado del drift.
        const loopElapsedSec = (elapsedMs - config.entryDurationMs) / 1000;
        const circleAngle =
          config.startAngleRad + loopElapsedSec * config.angularSpeedRadPerSec * config.spinDirection;
        const bobX = Math.cos(config.floatPhase + loopElapsedSec * 1.15) * config.floatXAmplitudePx;
        const bobY = Math.sin(config.floatPhase + loopElapsedSec * 1.05) * config.floatYAmplitudePx;
        const circlePoint = getCirclePoint(centerX, centerY, config.radiusPx, circleAngle);
        const tangentAngleDeg =
          (circleAngle * 180) / Math.PI + config.spinDirection * 90 + config.headingLeadDeg;
        const x = circlePoint.x + bobX;
        const y = circlePoint.y + bobY;
        const headingDeg = tangentAngleDeg + config.baseAngleDeg;
        actor.currentX = x;
        actor.currentY = y;
        actor.currentHeadingDeg = headingDeg;
        actor.currentScale = config.scale;
        actor.centerX = centerX;
        actor.centerY = centerY;
        node.style.opacity = "0.88";
        node.style.transform =
          `translate(${x}px, ${y}px) translate(-50%, -50%) ` +
          `rotate(${headingDeg}deg) scale(${config.scale})`;
      },
    };
    actor.startedAt = nowMs();

    this.actors.add(actor);
    this.ensureLoop();
  }

  launchDonutExitSequence() {
    const donutActors = Array.from(this.actors).filter((actor) => actor.role === "donut");
    if (!donutActors.length) return;

    donutActors.forEach((actor) => {
      this.convertDonutActorToExitMotion(actor, this.getBounds());
    });
  }

  convertDonutActorToExitMotion(actor, bounds) {
    if (!actor?.node) return;

    const start = {
      x: Number.isFinite(actor.currentX) ? actor.currentX : bounds.width * 0.5,
      y: Number.isFinite(actor.currentY) ? actor.currentY : bounds.height * 0.5,
    };
    const headingDeg = Number.isFinite(actor.currentHeadingDeg) ? actor.currentHeadingDeg : 0;
    const headingRad = (headingDeg * Math.PI) / 180;
    const forward = normalizeVector(Math.cos(headingRad), Math.sin(headingRad));
    const outward = normalizeVector(start.x - Number(actor.centerX || start.x), start.y - Number(actor.centerY || start.y), forward.x, forward.y);
    const exitDirection = normalizeVector(
      forward.x + outward.x * INSANO_EXIT_VECTOR.outwardBlend,
      forward.y + outward.y * INSANO_EXIT_VECTOR.outwardBlend,
      forward.x,
      forward.y
    );
    const end = projectToOffscreenPoint(bounds, start, exitDirection, INSANO_EXIT_VECTOR.overflowPx);
    const scale = Number(actor.currentScale || 1.12);
    const opacity = 0.88;
    const angleDeg = getAngleDeg(start, end);

    // Convertimos la dona viva en una huida lineal para que salga "manejando"
    // y no se desvanezca de golpe al cambiar de pista.
    actor.kind = "motion";
    actor.role = "donut-exit";
    actor.patternKey = "donut-exit";
    actor.directionGroup = "donut-exit";
    actor.entryZone = "";
    actor.exitZone = "";
    actor.startedAt = nowMs();
    actor.duration = randomBetween(INSANO_EXIT_VECTOR.durationMs.min, INSANO_EXIT_VECTOR.durationMs.max);
    actor.render = (_bounds, rawProgress) => {
      const progress = easeOutCubic(rawProgress);
      const x = lerp(start.x, end.x, progress);
      const y = lerp(start.y, end.y, progress);
      actor.currentX = x;
      actor.currentY = y;
      actor.currentHeadingDeg = angleDeg;
      actor.currentScale = scale;
      actor.node.style.opacity = String(opacity);
      actor.node.style.transform =
        `translate(${x}px, ${y}px) translate(-50%, -50%) ` +
        `rotate(${angleDeg}deg) scale(${scale})`;
    };
  }

  applyMode(mode) {
    this.clearProgramTimers();
    this.insanoSupportMotos = [];
    this.insanoSupportPassIndex = 0;
    if (this.currentMode === "donut" && mode !== "donut") {
      this.launchDonutExitSequence();
    }
    // En cambios de pista solo frenamos el programa que genera motos nuevas.
    // Las motos ya visibles siguen su ruta y se eliminan hasta quedar fuera de pantalla.
    this.currentMode = mode;

    if (mode === "regular") {
      this.startRegularProgram();
      return;
    }
    if (mode === "donut") {
      this.startDonutProgram();
      return;
    }
    if (mode === "cross") {
      this.startCrossProgram();
    }
  }

  startRegularProgram() {
    this.spawnRegularPass();
    this.modeAuxTimerId = window.setTimeout(() => {
      this.modeAuxTimerId = 0;
      if (this.currentMode === "regular") {
        this.spawnRegularPass();
      }
    }, 210);
    this.scheduleRegularPass();
  }

  scheduleRegularPass() {
    this.modeTimerId = window.setTimeout(() => {
      this.modeTimerId = 0;
      if (this.currentMode !== "regular") return;
      if (this.countActors("traffic") < MAX_REGULAR_ACTORS) {
        this.spawnRegularPass();
      }
      this.scheduleRegularPass();
    }, randomBetween(640, 1120));
  }

  spawnRegularPass() {
    if (this.countActors("traffic") >= MAX_REGULAR_ACTORS) return;

    const activePatternKeys = new Set();
    const activeDirectionGroups = new Set();
    const activeEntryZones = new Set();
    const activeExitZones = new Set();
    const blockedMotoIds = [];
    this.actors.forEach((actor) => {
      if (actor.role === "traffic") {
        activePatternKeys.add(actor.patternKey);
        if (actor.directionGroup) activeDirectionGroups.add(actor.directionGroup);
        if (actor.entryZone) activeEntryZones.add(actor.entryZone);
        if (actor.exitZone) activeExitZones.add(actor.exitZone);
        blockedMotoIds.push(actor.motoId);
      }
    });

    const basePatterns = REGULAR_PATTERNS.filter(
      (pattern) => !activePatternKeys.has(pattern.key) && pattern.key !== this.lastTrafficPatternKey
    );
    // Primero intentamos repartir direcciones y zonas de entrada/salida para que
    // cuatro motos no se vean como si fueran a chocar en el mismo carril visual.
    let patterns = basePatterns.filter(
      (pattern) =>
        !activeDirectionGroups.has(pattern.directionGroup) &&
        pattern.directionGroup !== this.lastTrafficDirectionGroup &&
        !activeEntryZones.has(pattern.entryZone) &&
        !activeExitZones.has(pattern.exitZone)
    );
    if (!patterns.length) {
      patterns = basePatterns.filter(
        (pattern) =>
          !activeDirectionGroups.has(pattern.directionGroup) &&
          !activeEntryZones.has(pattern.entryZone)
      );
    }
    if (!patterns.length) {
      patterns = basePatterns.filter(
        (pattern) => !activeDirectionGroups.has(pattern.directionGroup)
      );
    }
    if (!patterns.length) {
      patterns = REGULAR_PATTERNS.filter((pattern) => !activePatternKeys.has(pattern.key));
    }

    const selectedPattern = pickRandom(patterns);
    const moto = this.pickMotoBatch(1, blockedMotoIds)[0];
    if (!selectedPattern || !moto) return;

    const route = selectedPattern.create(this.getBounds());
    this.lastTrafficPatternKey = selectedPattern.key;
    this.lastTrafficDirectionGroup = selectedPattern.directionGroup;
    this.createMotionActor({
      moto,
      role: "traffic",
      className: "is-traffic",
      patternKey: selectedPattern.key,
      directionGroup: selectedPattern.directionGroup,
      entryZone: selectedPattern.entryZone,
      exitZone: selectedPattern.exitZone,
      start: route.start,
      end: route.end,
      duration: route.duration,
      arc: route.arc,
      scale: randomBetween(0.94, 1.16),
      opacity: randomBetween(0.68, 0.9),
    });
  }

  spawnMt09Pass() {
    const bounds = this.getBounds();
    const fromRight = Math.random() < 0.5;
    const directionKey = fromRight ? "mt09-rl" : "mt09-lr";
    const useTopLane =
      this.lastMt09DirectionKey === directionKey ? Math.random() < 0.35 : Math.random() < 0.5;
    this.lastMt09DirectionKey = directionKey;

    const route = createHorizontalPass(
      bounds,
      fromRight,
      useTopLane ? randomBetween(0.18, 0.3) : randomBetween(0.68, 0.82)
    );
    const moto = this.pickMotoBatch(1)[0];
    if (!moto) return;

    this.createMotionActor({
      moto,
      role: "overlay",
      className: "is-overlay",
      patternKey: directionKey,
      start: route.start,
      end: route.end,
      duration: randomBetween(480, 720),
      arc: 0,
      scale: randomBetween(1.08, 1.24),
      opacity: 0.96,
      easing: easeOutCubic,
    });
  }

  pickInsanoApproachSide(usedSides = new Set()) {
    const sides = ["left", "right", "top", "bottom"];
    const availableSides = sides.filter((side) => !usedSides.has(side));
    return pickRandom(availableSides.length ? availableSides : sides) || "left";
  }

  startDonutSupportProgram(supportMotos = []) {
    this.insanoSupportMotos = Array.isArray(supportMotos) ? supportMotos.slice(0, 2) : [];
    this.insanoSupportPassIndex = 0;
    if (this.insanoSupportMotos.length < 2) return;
    this.scheduleDonutSupportPass(
      randomBetween(INSANO_SUPPORT_PASS.initialDelayMs.min, INSANO_SUPPORT_PASS.initialDelayMs.max)
    );
  }

  scheduleDonutSupportPass(
    delayMs = randomBetween(INSANO_SUPPORT_PASS.delayMs.min, INSANO_SUPPORT_PASS.delayMs.max)
  ) {
    this.modeTimerId = window.setTimeout(() => {
      this.modeTimerId = 0;
      if (this.currentMode !== "donut") return;
      this.spawnDonutSupportPass();
      this.scheduleDonutSupportPass();
    }, delayMs);
  }

  spawnDonutSupportPass() {
    if (this.currentMode !== "donut" || this.insanoSupportMotos.length < 2) return;

    const bounds = this.getBounds();
    const passIndex = this.insanoSupportPassIndex;
    const isHorizontal = passIndex % 2 === 0;
    const moto = this.insanoSupportMotos[passIndex % this.insanoSupportMotos.length];
    this.insanoSupportPassIndex += 1;

    const route = isHorizontal
      ? createHorizontalPass(
          bounds,
          Math.random() < 0.5,
          randomBetween(
            INSANO_SUPPORT_PASS.horizontalYRatio.min,
            INSANO_SUPPORT_PASS.horizontalYRatio.max
          )
        )
      : createVerticalPass(
          bounds,
          Math.random() < 0.5,
          randomBetween(
            INSANO_SUPPORT_PASS.verticalXRatio.min,
            INSANO_SUPPORT_PASS.verticalXRatio.max
          )
        );

    this.createMotionActor({
      moto,
      role: "insano-support",
      className: "is-overlay",
      patternKey: isHorizontal ? "insano-support-horizontal" : "insano-support-vertical",
      start: route.start,
      end: route.end,
      duration: randomBetween(INSANO_SUPPORT_PASS.durationMs.min, INSANO_SUPPORT_PASS.durationMs.max),
      arc: 0,
      scale: randomBetween(1.08, 1.22),
      opacity: 0.94,
      easing: easeOutCubic,
    });
  }

  startDonutProgram() {
    const motos = this.pickMotoBatch(4);
    if (motos.length < 4) return;
    const bounds = this.getBounds();
    const usedApproachSides = new Set();
    const donutMotoIds = new Set(motos.map((moto) => moto.id));
    const supportMotos = GARAGE_MOTOS.filter((moto) => !donutMotoIds.has(moto.id)).slice(0, 2);

    this.startDonutSupportProgram(supportMotos);

    // Conservamos el nombre del metodo para no tocar el resto del flujo,
    // pero aqui realmente pintamos el "modo insano" en las cuatro esquinas.
    INSANO_CORNER_ANCHORS.forEach((anchor, index) => {
      const moto = motos[index];
      if (!moto) return;
      const approachSide = this.pickInsanoApproachSide(usedApproachSides);
      usedApproachSides.add(approachSide);
      const centerX = bounds.width * anchor.xRatio;
      const centerY = bounds.height * anchor.yRatio;
      const radiusPx = randomBetween(INSANO_DRIFT_CIRCLE.radiusPx.min, INSANO_DRIFT_CIRCLE.radiusPx.max);
      // El punto de entrada se calcula para que la llegada ya venga alineada con la tangente
      // del donut, evitando un "teleport" raro justo cuando empieza la vuelta.
      const startAngleRad = getApproachHeading(approachSide) - anchor.spinDirection * (Math.PI / 2);
      const entryEnd = getCirclePoint(centerX, centerY, radiusPx, startAngleRad);
      const entryStart = createOffscreenApproach(bounds, approachSide, entryEnd);
      const visualSpeedPxPerSec = randomBetween(
        INSANO_DRIFT_CIRCLE.visualSpeedPxPerSec.min,
        INSANO_DRIFT_CIRCLE.visualSpeedPxPerSec.max
      );
      this.createSpinActor({
        moto,
        anchorXRatio: anchor.xRatio,
        anchorYRatio: anchor.yRatio,
        baseAngleDeg: anchor.baseAngleDeg,
        spinDirection: anchor.spinDirection,
        radiusPx,
        startAngleRad,
        angularSpeedRadPerSec: visualSpeedPxPerSec / Math.max(24, radiusPx),
        headingLeadDeg: anchor.spinDirection * randomBetween(
          INSANO_DRIFT_CIRCLE.headingLeadDeg.min,
          INSANO_DRIFT_CIRCLE.headingLeadDeg.max
        ),
        entryStart,
        entryEnd,
        entryDurationMs: randomBetween(
          INSANO_DRIFT_CIRCLE.entryDurationMs.min,
          INSANO_DRIFT_CIRCLE.entryDurationMs.max
        ),
        floatXAmplitudePx: randomBetween(
          INSANO_DRIFT_CIRCLE.idleBobPx.x * 0.7,
          INSANO_DRIFT_CIRCLE.idleBobPx.x
        ),
        floatYAmplitudePx: randomBetween(
          INSANO_DRIFT_CIRCLE.idleBobPx.y * 0.7,
          INSANO_DRIFT_CIRCLE.idleBobPx.y
        ),
        floatPhase: (Math.PI * 2 * index) / INSANO_CORNER_ANCHORS.length,
        scale: randomBetween(1.08, 1.22),
      });
    });
  }

  startCrossProgram() {
    this.spawnCrossWave();
    this.scheduleCrossWave();
  }

  scheduleCrossWave() {
    this.modeTimerId = window.setTimeout(() => {
      this.modeTimerId = 0;
      if (this.currentMode !== "cross") return;
      this.spawnCrossWave();
      this.scheduleCrossWave();
    }, randomBetween(2100, 2900));
  }

  spawnCrossWave() {
    // No limpiamos motos previas en seco: dejamos que terminen de salir de pantalla.
    const motos = this.pickMotoBatch(4);
    const bounds = this.getBounds();

    CROSS_PATTERNS.forEach((pattern, index) => {
      const moto = motos[index];
      if (!moto) return;
      const route = createDiagonalPass(bounds, pattern.fromCorner, pattern.toCorner);
      this.createMotionActor({
        moto,
        role: "cross",
        className: "is-cross",
        patternKey: pattern.key,
        start: route.start,
        end: route.end,
        duration: randomBetween(1700, 2200),
        arc: 0,
        scale: randomBetween(1, 1.18),
        opacity: 0.84,
      });
    });
  }
}
