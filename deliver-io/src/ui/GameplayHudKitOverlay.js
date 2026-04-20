import "./hud.css";
import { WEATHER_EVENT_TYPES } from "../events/weather/catalog.js";
import { getItemLabel, ITEM_TYPES } from "../items/catalog.js";
import appAudioManager from "./AppAudioManager.js";
import {
  getDashboardModeMeta,
  loadSelectedDashboardMode,
} from "./dashboardModes.js";
import {
  HUD_MAX_SPEED_KMH,
  speedPxPerSecToKmh,
} from "../world/race/utils/telemetry.js";
import { formatRaceTime } from "./hud/formatters.js";

const FINISH_CALL_SECONDS = new Set([20, 15, 10, 5, 3, 2, 1]);
const SETTINGS_AUDIO_ICONS = Object.freeze({
  music:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 3v12.55A4 4 0 1 1 14 12V7.2l-6 1.4v6.9A4 4 0 1 1 6 12V7l10-4z"/></svg>',
  sfx:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 10.5V13.5H7.25L12 18V6L7.25 10.5H3ZM15.5 9.25A4.25 4.25 0 0 1 15.5 14.75L16.9 16.15A6.2 6.2 0 0 0 16.9 7.85L15.5 9.25ZM18.3 6.45A8.15 8.15 0 0 1 18.3 17.55L19.7 18.95A10.1 10.1 0 0 0 19.7 5.05L18.3 6.45Z"/></svg>',
});
const ITEM_IMAGE_BY_TYPE = Object.freeze({
  [ITEM_TYPES.OIL]: "/assets/items/aceite.png",
  [ITEM_TYPES.WALL]: "/assets/items/muro.png",
  [ITEM_TYPES.EMP]: "/assets/items/PEM.png",
  [ITEM_TYPES.SHIELD]: "/assets/items/escudo.png",
  [ITEM_TYPES.GHOST]: "/assets/items/fantasma.png",
});
const TURBO_IMAGE_PATH = "/assets/items/nitro.png";
const DASH_DIAL_ANGLE_START = -132;
const DASH_DIAL_ANGLE_END = 132;
const SEVEN_SEGMENT_CHAR_MAP = Object.freeze({
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "e", "d", "c", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  " ": [],
});
const DASH_ANALOG_RPM_LABELS = Object.freeze([0, 2, 4, 6, 8, 10, 12]);
const DASH_ANALOG_SPEED_LABELS = Object.freeze(
  Array.from({ length: 13 }, (_, index) => index * 20)
);
const DASH_HYBRID_RPM_LABELS = Object.freeze([1, 3, 5, 7, 9, 11, 13]);
const DASH_DIGITAL_RPM_SCALE_LABELS = Object.freeze(
  Array.from({ length: 15 }, (_, index) => index + 1)
);

function getItemImagePath(type) {
  return ITEM_IMAGE_BY_TYPE[String(type || "").toLowerCase()] || "";
}

function numberColorToCss(colorValue, fallback = "#ffd56a") {
  const numeric = Number(colorValue);
  if (!Number.isFinite(numeric)) return fallback;
  const clamped = Math.max(0, Math.min(0xffffff, Math.round(numeric)));
  return `#${clamped.toString(16).padStart(6, "0")}`;
}

function clamp01(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatPercent(value) {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dialAngleForRatio(ratio) {
  const clamped = Math.max(0, Math.min(1, Number(ratio || 0)));
  return DASH_DIAL_ANGLE_START + (DASH_DIAL_ANGLE_END - DASH_DIAL_ANGLE_START) * clamped;
}

function buildDashDialTicks({
  count = 29,
  majorEvery = 4,
  warningFromRatio = 1,
} = {}) {
  const safeCount = Math.max(2, Math.round(Number(count || 29)));
  const safeMajorEvery = Math.max(1, Math.round(Number(majorEvery || 4)));
  const safeWarningFromRatio = Math.max(0, Math.min(1, Number(warningFromRatio ?? 1)));

  return Array.from({ length: safeCount }, (_, index) => {
    const ratio = safeCount <= 1 ? 0 : index / (safeCount - 1);
    const classes = ["ghuk-dial-tick"];
    if (index % safeMajorEvery === 0 || index === safeCount - 1) {
      classes.push("is-major");
    }
    if (ratio >= safeWarningFromRatio) {
      classes.push("is-warning");
    }
    return `<span class="${classes.join(" ")}" style="--ghuk-dial-angle:${dialAngleForRatio(ratio).toFixed(2)}deg"></span>`;
  }).join("");
}

function buildDashDialLabels(values = [], maxValue = 1) {
  const safeMaxValue = Math.max(1, Number(maxValue || 1));
  return values
    .map((value) => {
      const numericValue = Number(value);
      const ratio = Number.isFinite(numericValue) ? numericValue / safeMaxValue : 0;
      return `
        <span class="ghuk-dial-label" style="--ghuk-dial-angle:${dialAngleForRatio(ratio).toFixed(2)}deg">
          <span>${escapeHtml(value)}</span>
        </span>
      `;
    })
    .join("");
}

function buildDashDialMarkup({
  kind = "",
  needleRef = "",
  needleClass = "",
  title = "",
  foot = "",
  labels = [],
  maxValue = 1,
  tickCount = 29,
  majorEvery = 4,
  warningFromRatio = 1,
} = {}) {
  const safeKind = escapeHtml(kind);
  const safeTitle = escapeHtml(title);
  const safeFoot = escapeHtml(foot);
  const safeNeedleClass = needleClass ? ` ${needleClass}` : "";

  return `
    <div class="ghuk-dial ghuk-dial--${safeKind}">
      <div class="ghuk-dial-ticks">
        ${buildDashDialTicks({ count: tickCount, majorEvery, warningFromRatio })}
      </div>
      <div class="ghuk-dial-labels">
        ${buildDashDialLabels(labels, maxValue)}
      </div>
      <div class="ghuk-dial-inner">
        <div class="ghuk-dial-title">${safeTitle}</div>
        <div class="ghuk-dial-foot">${safeFoot}</div>
      </div>
      <div class="ghuk-dial-needle${safeNeedleClass}" data-ref="${needleRef}"></div>
      <div class="ghuk-dial-center"></div>
    </div>
  `;
}

function formatDashboardSpeed(value, minDigits = 3) {
  const safeValue = Math.max(0, Math.round(Number(value || 0)));
  return String(safeValue).padStart(Math.max(1, Number(minDigits || 1)), "0");
}

function formatDashboardRpmCompact(rpm) {
  const safeRpm = Math.max(0, Number(rpm || 0));
  return `${(safeRpm / 1000).toFixed(1)} x1000`;
}

function formatDashboardRpmShort(rpm) {
  const safeRpm = Math.max(0, Number(rpm || 0));
  return `${(safeRpm / 1000).toFixed(1)}`;
}

function buildSevenSegmentDisplayMarkup(value, {
  digits = 3,
  className = "",
  blankLeading = false,
} = {}) {
  const safeDigits = Math.max(1, Math.round(Number(digits || 3)));
  const numericText = String(value ?? "").replace(/[^\d]/g, "");
  const padded = numericText
    .slice(-safeDigits)
    .padStart(safeDigits, blankLeading ? " " : "0");

  const digitMarkup = padded
    .split("")
    .map((char) => {
      const activeSegments = SEVEN_SEGMENT_CHAR_MAP[char] || [];
      const muted = char === " ";
      return `
        <span class="ghuk-7seg-digit${muted ? " is-muted" : ""}">
          ${["a", "b", "c", "d", "e", "f", "g"]
            .map(
              (segment) =>
                `<span class="ghuk-7seg-segment ghuk-7seg-segment--${segment}${activeSegments.includes(segment) ? " is-on" : ""}"></span>`
            )
            .join("")}
        </span>
      `;
    })
    .join("");

  return `<span class="ghuk-7seg-display ${className}">${digitMarkup}</span>`;
}

function buildMeterSegmentsMarkup(count = 24, segmentClass = "ghuk-meter-segment") {
  const safeCount = Math.max(2, Math.round(Number(count || 24)));
  return Array.from(
    { length: safeCount },
    () => `<span class="${segmentClass}"></span>`
  ).join("");
}

function buildScaleLabelMarkup(values = [], itemClass = "ghuk-scale-mark") {
  return values
    .map((value) => `<span class="${itemClass}">${escapeHtml(value)}</span>`)
    .join("");
}

function weatherLabel(type) {
  switch (String(type || "").toLowerCase()) {
    case WEATHER_EVENT_TYPES.RAIN:
      return "Heavy Rain";
    case WEATHER_EVENT_TYPES.SUNNY:
      return "Sunny Weather";
    case WEATHER_EVENT_TYPES.NIGHT:
      return "Night Event";
    case WEATHER_EVENT_TYPES.EARTHQUAKE:
      return "Earthquake Event";
    default:
      return "No Weather";
  }
}

function weatherChip(type) {
  switch (String(type || "").toLowerCase()) {
    case WEATHER_EVENT_TYPES.RAIN:
      return "RAIN";
    case WEATHER_EVENT_TYPES.SUNNY:
      return "SUN";
    case WEATHER_EVENT_TYPES.NIGHT:
      return "NIGHT";
    case WEATHER_EVENT_TYPES.EARTHQUAKE:
      return "QUAKE";
    default:
      return "CLEAR";
  }
}

function bannerToneFromHealthDrop(percent) {
  if (percent <= 22) return "danger";
  if (percent <= 45) return "warning";
  return "info";
}

export default class GameplayHudKitOverlay {
  constructor(scene) {
    this.scene = scene;
    this.isGameplayHudKit = true;
    this.visible = true;
    this.minimapData = null;
    this.lastBannerUntilMs = 0;
    this.lastOrderCount = 0;
    this.lastPackageHealth = 100;
    this.lastTurboActive = false;
    this.lastHeatCooling = false;
    this.lastWeatherType = WEATHER_EVENT_TYPES.NONE;
    this.lastCountdownLabel = "";
    this.lastFinishCallSecond = -1;
    this.lastSpectatorTargetId = "";
    this.lastInventoryItems = [];
    this.lastInventorySignature = null;
    this.hasRenderedInventoryState = false;
    this.lastMotoHealthPercent = 100;
    this.lastRepairing = false;
    this.lastTurboCharges = 0;
    this.lastTurboMaxCharges = 3;
    this.lastTurboSignature = "";
    this.hasRenderedTurboState = false;
    this.lastMinimapState = {
      localPlayer: null,
      remotePlayers: [],
      objective: null,
    };
    this.minimapTextureKey = "";
    this.minimapTextureImage = null;
    this.dashboardMode = loadSelectedDashboardMode();
    this.settingsMenuOpen = false;

    this.createDom();
    this.attachHandlers();

    this.handleResize = this.handleResize.bind(this);
    this.scene.scale.on("resize", this.handleResize, this);
    this.handleResize(this.scene.scale.gameSize);
  }

  createDom() {
    const appRoot = document.getElementById("app");
    if (!appRoot) {
      throw new Error("No se encontro #app para montar el HUD overlay");
    }
    appRoot.style.position = "relative";

    this.root = document.createElement("div");
    this.root.className = "ghuk-root";
    this.root.innerHTML = `
      <div class="ghuk-overlay" data-weather="none"></div>
      <div class="ghuk-rain-glass"></div>
      <div class="ghuk-vignette"></div>
      <div class="ghuk-top-bars"></div>
      <div class="ghuk-bottom-bars"></div>

      <section class="ghuk-card ghuk-race">
        <div class="title" data-ref="orderText">Order 0/0</div>
        <div class="destination" data-ref="destinationText">Destination: --</div>
        <div class="timer" data-ref="timerText">00:00.00</div>
      </section>

      <section class="ghuk-banner ghuk-hidden" data-ref="banner"></section>
      <section class="ghuk-weather-event ghuk-hidden" data-ref="weatherEventText"></section>
      <section class="ghuk-spectator ghuk-hidden" data-ref="spectatorRoot">
        <button class="ghuk-spectator-nav ghuk-spectator-nav--left" data-ref="spectatorPrev" type="button" aria-label="Jugador anterior">&lt;</button>
        <div class="ghuk-spectator-center">
          <div class="ghuk-spectator-label">Espectando</div>
          <div class="ghuk-spectator-name" data-ref="spectatorName">Jugador</div>
          <div class="ghuk-spectator-status ghuk-hidden" data-ref="spectatorStatus">Finalizado</div>
        </div>
        <button class="ghuk-spectator-nav ghuk-spectator-nav--right" data-ref="spectatorNext" type="button" aria-label="Siguiente jugador">&gt;</button>
      </section>
      <section class="ghuk-settings-modal ghuk-hidden" data-ref="settingsModal" aria-hidden="true">
        <button class="ghuk-settings-backdrop" data-ref="settingsBackdrop" type="button" aria-label="Cerrar ajustes de partida"></button>
        <div class="ghuk-settings-shell">
          <div class="ghuk-settings-header">
            <div class="ghuk-settings-title">Ajustes Rapidos</div>
            <button class="ghuk-settings-close" data-ref="settingsClose" type="button" aria-label="Cerrar ajustes">
              <span class="ghuk-settings-close-label">X</span>
            </button>
          </div>
          <div class="ghuk-settings-row">
            <button class="ghuk-settings-mute-btn ghuk-settings-mute-btn--sfx" data-ref="sfxMuteButton" type="button" aria-label="Silenciar efectos">
              <span class="ghuk-settings-mute-icon" data-ref="sfxMuteIcon">${SETTINGS_AUDIO_ICONS.sfx}</span>
            </button>
            <div class="ghuk-settings-slider-wrap">
              <div class="ghuk-settings-slider-label">
                <span>Efectos</span>
                <span data-ref="sfxVolumeValue">75%</span>
              </div>
              <input class="ghuk-settings-slider" data-ref="sfxSlider" type="range" min="0" max="100" step="1" value="75" />
            </div>
          </div>
          <div class="ghuk-settings-row">
            <button class="ghuk-settings-mute-btn ghuk-settings-mute-btn--music" data-ref="musicMuteButton" type="button" aria-label="Silenciar musica">
              <span class="ghuk-settings-mute-icon" data-ref="musicMuteIcon">${SETTINGS_AUDIO_ICONS.music}</span>
            </button>
            <div class="ghuk-settings-slider-wrap">
              <div class="ghuk-settings-slider-label">
                <span>Musica</span>
                <span data-ref="musicVolumeValue">75%</span>
              </div>
              <input class="ghuk-settings-slider" data-ref="musicSlider" type="range" min="0" max="100" step="1" value="75" />
            </div>
          </div>
          <button class="lhl-btn lhl-btn-leave ghuk-settings-leave-btn" data-ref="leaveMatchButton" type="button">
            <span class="lhl-btn-label">Salir de partida</span>
          </button>
        </div>
      </section>

      <section class="ghuk-card ghuk-minimap">
        <div class="ghuk-minimap-title">Minimap</div>
        <div class="ghuk-minimap-track" data-ref="gameTrackLabel">Partida: esperando</div>
        <div class="ghuk-minimap-canvas-wrap">
          <canvas data-ref="minimapCanvas"></canvas>
        </div>
      </section>

      <section class="ghuk-card ghuk-heat" data-ref="heatCard">
        <div class="ghuk-heat-title">Engine Heat</div>
        <div class="ghuk-heat-track"><div class="ghuk-heat-fill" data-ref="heatFill"></div></div>
        <div class="ghuk-heat-value" data-ref="heatValue">0%</div>
      </section>

      <section class="ghuk-card ghuk-weather-indicator" data-ref="weatherIndicator">CLEAR</section>

      <section class="ghuk-card ghuk-package">
        <div class="title">Package Status</div>
        <div class="integrity" data-ref="integrityValue">100%</div>
        <div class="quality" data-ref="qualityValue">Average Quality: 100%</div>
      </section>

      <section class="ghuk-card ghuk-dashboard" data-ref="dashboardCard">
        <div class="ghuk-dashboard-top">
          <div class="header">Motorcycle Dashboard</div>
          <div class="ghuk-dash-mode-badge" data-ref="dashModeBadge">Analog</div>
        </div>
        <div class="ghuk-dashboard-boost"></div>
        <div class="ghuk-dashboard-overdrive"></div>
        <div class="ghuk-dashboard-hit"></div>
        <div class="ghuk-dashboard-glass">
          <span class="ghuk-dashboard-crack ghuk-dashboard-crack--a"></span>
          <span class="ghuk-dashboard-crack ghuk-dashboard-crack--b"></span>
          <span class="ghuk-dashboard-crack ghuk-dashboard-crack--c"></span>
          <span class="ghuk-dashboard-crack ghuk-dashboard-crack--d"></span>
          <span class="ghuk-dashboard-crack ghuk-dashboard-crack--e"></span>
        </div>

        <div class="ghuk-dash-mode ghuk-dash-mode-dual" data-ref="modeDual">
          <div class="ghuk-analog-cluster ghuk-analog-cluster--reference">
            <div class="ghuk-dial-wrap">
              ${buildDashDialMarkup({
                kind: "rpm",
                needleRef: "rpmNeedle",
                needleClass: "ghuk-dial-needle--rpm",
                title: "",
                foot: "x1000/min",
                labels: DASH_ANALOG_RPM_LABELS,
                maxValue: 12,
                tickCount: 25,
                majorEvery: 2,
                warningFromRatio: 0.82,
              })}
            </div>
            <div class="ghuk-dial-wrap">
              ${buildDashDialMarkup({
                kind: "speed",
                needleRef: "speedNeedle",
                title: "",
                foot: "km/h",
                labels: DASH_ANALOG_SPEED_LABELS,
                maxValue: 240,
                tickCount: 25,
                majorEvery: 2,
                warningFromRatio: 1,
              })}
            </div>
          </div>
        </div>

        <div class="ghuk-dash-mode ghuk-dash-mode-hybrid ghuk-hidden" data-ref="modeHybrid">
          <div class="ghuk-hybrid-cluster">
            <div class="ghuk-hybrid-rpm-shell">
              ${buildDashDialMarkup({
                kind: "rpm-yamaha",
                needleRef: "rpmHybridNeedle",
                needleClass: "ghuk-dial-needle--rpm",
                title: "",
                foot: "x1000",
                labels: DASH_HYBRID_RPM_LABELS,
                maxValue: 13,
                tickCount: 37,
                majorEvery: 3,
                warningFromRatio: 0.74,
              })}
            </div>
            <div class="ghuk-hybrid-screen-shell">
              <div class="ghuk-hybrid-screen">
                <div class="ghuk-hybrid-screen-top">
                  <span class="ghuk-hybrid-brand-chip">REP</span>
                  <div class="ghuk-hybrid-brand">YAMAHA</div>
                </div>
                <div class="ghuk-hybrid-screen-main">
                  <div class="ghuk-hybrid-speed-stack">
                    <div class="ghuk-hybrid-speed-caption">speed</div>
                    <div class="ghuk-hybrid-speed-display" data-ref="speedHybridValue">
                      ${buildSevenSegmentDisplayMarkup("000", { digits: 3, className: "ghuk-7seg-display--hybrid" })}
                    </div>
                  </div>
                  <div class="ghuk-hybrid-screen-unit">km/h</div>
                </div>
                <div class="ghuk-hybrid-screen-bottom">
                  <span class="ghuk-hybrid-screen-chip">ODO</span>
                  <span class="ghuk-hybrid-screen-rpm" data-ref="rpmHybridValue">1.0 x1000</span>
                  <span class="ghuk-hybrid-screen-chip">LIVE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="ghuk-dash-mode ghuk-dash-mode-digital ghuk-hidden" data-ref="modeDigital">
          <div class="ghuk-digital-shell">
            <div class="ghuk-digital-rpm-head">
              <span class="ghuk-digital-rpm-label">RPM</span>
              <div class="ghuk-digital-rpm-scale">
                ${buildScaleLabelMarkup(DASH_DIGITAL_RPM_SCALE_LABELS, "ghuk-digital-rpm-scale-mark")}
              </div>
            </div>
            <div class="ghuk-digital-rpm-track">
              <div class="ghuk-digital-rpm-segments" data-ref="rpmBarFill">
                ${buildMeterSegmentsMarkup(24, "ghuk-digital-rpm-segment")}
              </div>
            </div>
            <div class="ghuk-digital-frame">
              <div class="ghuk-digital-corners ghuk-digital-corners--left"></div>
              <div class="ghuk-digital-corners ghuk-digital-corners--right"></div>
              <div class="ghuk-digital-mode-line">
                <span class="ghuk-digital-chip">READY</span>
                <span class="ghuk-digital-chip">SEG</span>
              </div>
              <div class="ghuk-digital-speed-wrap">
                <div class="ghuk-digital-speed-display" data-ref="speedDigitalValue">
                  ${buildSevenSegmentDisplayMarkup("000", { digits: 3, className: "ghuk-7seg-display--digital" })}
                </div>
                <div class="ghuk-digital-unit">km/h</div>
              </div>
              <div class="ghuk-digital-footer">
                <span class="ghuk-digital-footer-tag">RPM</span>
                <span data-ref="rpmDigitalValue">1000</span>
                <span class="ghuk-digital-footer-tag">ODO</span>
              </div>
            </div>
          </div>
        </div>

        <div class="ghuk-dash-mode ghuk-dash-mode-lcd ghuk-hidden" data-ref="modeLcd">
          <div class="ghuk-lcd-panel">
            <div class="ghuk-lcd-stage">
              <div class="ghuk-lcd-rail ghuk-lcd-rail--left">
                <span class="ghuk-lcd-rail-chip is-green">N</span>
                <span class="ghuk-lcd-rail-chip is-amber">ABS</span>
              </div>
              <div class="ghuk-lcd-arc-wrap">
                <div class="ghuk-lcd-arc-shell">
                  <div class="ghuk-lcd-screen-art"></div>
                  <div class="ghuk-lcd-meter ghuk-lcd-meter--left">
                    <div class="ghuk-lcd-meter-fill" data-ref="rpmLcdFill"></div>
                  </div>
                  <div class="ghuk-lcd-meter ghuk-lcd-meter--right">
                    <div class="ghuk-lcd-meter-fill" data-ref="rpmLcdFillMirror"></div>
                  </div>
                  <div class="ghuk-lcd-arc-progress"></div>
                  <div class="ghuk-lcd-arc-band"></div>
                  <div class="ghuk-lcd-speed-block">
                    <div class="ghuk-lcd-speed" data-ref="speedLcdValue">0</div>
                    <div class="ghuk-lcd-unit">km/h</div>
                    <div class="ghuk-lcd-rpm-readout">
                      <span class="ghuk-lcd-rpm-readout-label">RPM</span>
                      <span data-ref="rpmLcdValue">1.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="ghuk-dash-health">
          <div class="ghuk-dash-health-track" data-ref="healthTrack">
            <div class="ghuk-dash-health-fill" data-ref="healthFill"></div>
          </div>
        </div>
      </section>

      <section class="ghuk-inventory">
        <div class="ghuk-item-stack" data-ref="inventoryStack">
          <div class="ghuk-item-shell ghuk-item-shell--secondary is-empty" data-ref="slot2Shell">
            <div class="ghuk-item-content">
              <img class="ghuk-item-icon ghuk-hidden" data-ref="slot2Icon" alt="" draggable="false" />
            </div>
          </div>
          <div class="ghuk-item-shell ghuk-item-shell--primary is-empty" data-ref="slot1Shell">
            <div class="ghuk-item-content">
              <img class="ghuk-item-icon ghuk-hidden" data-ref="slot1Icon" alt="" draggable="false" />
            </div>
          </div>
          <div class="ghuk-item-transition-layer" data-ref="inventoryFx"></div>
        </div>
      </section>

      <section class="ghuk-turbo">
        <div class="ghuk-turbo-shell is-empty" data-ref="turboShell">
          <div class="ghuk-turbo-icon-wrap">
            <div class="ghuk-turbo-diamond">
              <img class="ghuk-turbo-icon" data-ref="turboIcon" src="${TURBO_IMAGE_PATH}" alt="Nitro" draggable="false" />
            </div>
          </div>
        </div>
        <div class="ghuk-turbo-dots" data-ref="turboDots">
          <span class="ghuk-turbo-dot"></span>
          <span class="ghuk-turbo-dot"></span>
          <span class="ghuk-turbo-dot"></span>
        </div>
        <div class="ghuk-turbo-transition-layer" data-ref="turboFx"></div>
      </section>

      <section class="ghuk-card ghuk-controls ghuk-hidden" data-ref="controls">
        <div class="ghuk-controls-title">Host Controls (Test)</div>
        <div class="ghuk-controls-group-title">Clima / Mapa</div>
        <div class="ghuk-controls-grid">
          <button class="ghuk-btn" data-weather-action="rain" data-tone="rain">Lluvia</button>
          <button class="ghuk-btn" data-weather-action="sunny" data-tone="sunny">Soleado</button>
          <button class="ghuk-btn" data-weather-action="night" data-tone="night">Noche</button>
          <button class="ghuk-btn" data-weather-action="earthquake" data-tone="earthquake">Terremoto</button>
          <button class="ghuk-btn" data-weather-action="clear" data-tone="clear">Clear</button>
          <button class="ghuk-btn" data-weather-action="train" data-tone="train">Train</button>
          <button class="ghuk-btn" data-weather-action="spectator" data-tone="spectator">Espectador</button>
          <button class="ghuk-btn" data-weather-action="finish_self" data-tone="finish">Llegar meta</button>
        </div>
        <div class="ghuk-controls-group-title">Items / Boost</div>
        <div class="ghuk-controls-grid">
          <button class="ghuk-btn" data-weather-action="grant_turbo" data-tone="turbo">+ Nitro</button>
          <button class="ghuk-btn" data-weather-action="grant_oil" data-tone="oil">+ Aceite</button>
          <button class="ghuk-btn" data-weather-action="grant_wall" data-tone="wall">+ Muro</button>
          <button class="ghuk-btn" data-weather-action="grant_emp" data-tone="emp">+ EMP</button>
          <button class="ghuk-btn" data-weather-action="grant_shield" data-tone="shield">+ Escudo</button>
          <button class="ghuk-btn" data-weather-action="grant_ghost" data-tone="ghost">+ Fantasma</button>
        </div>
      </section>

      <div class="ghuk-countdown ghuk-hidden" data-ref="countdown">
        <span data-ref="countdownValue">3</span>
      </div>

      <div class="ghuk-results ghuk-hidden" data-ref="resultsRoot">
        <div class="ghuk-results-card">
          <div class="ghuk-results-title" data-ref="resultsTitle">Results</div>
          <div class="ghuk-results-subtitle" data-ref="resultsSubtitle">Final ranking</div>
          <table class="ghuk-results-table" data-ref="resultsTable"></table>
        </div>
      </div>

      <section class="ghuk-card ghuk-return ghuk-hidden" data-ref="returnRoot">
        <div class="text" data-ref="returnText">Regreso al lobby en 0s</div>
        <div class="ghuk-return-actions">
          <button class="btn" data-ref="returnButton">Regresar</button>
          <button class="btn ghuk-return-btn-replay ghuk-hidden" data-ref="replayButton">Jugar de nuevo</button>
        </div>
      </section>
    `;

    appRoot.appendChild(this.root);

    const query = (ref) => this.root.querySelector(`[data-ref="${ref}"]`);
    this.refs = {
      overlay: this.root.querySelector(".ghuk-overlay"),
      rainGlass: this.root.querySelector(".ghuk-rain-glass"),
      orderText: query("orderText"),
      destinationText: query("destinationText"),
      timerText: query("timerText"),
      banner: query("banner"),
      weatherEventText: query("weatherEventText"),
      spectatorRoot: query("spectatorRoot"),
      spectatorPrev: query("spectatorPrev"),
      spectatorNext: query("spectatorNext"),
      spectatorName: query("spectatorName"),
      spectatorStatus: query("spectatorStatus"),
      settingsModal: query("settingsModal"),
      settingsBackdrop: query("settingsBackdrop"),
      settingsClose: query("settingsClose"),
      sfxMuteButton: query("sfxMuteButton"),
      sfxMuteIcon: query("sfxMuteIcon"),
      sfxVolumeValue: query("sfxVolumeValue"),
      sfxSlider: query("sfxSlider"),
      musicMuteButton: query("musicMuteButton"),
      musicMuteIcon: query("musicMuteIcon"),
      musicVolumeValue: query("musicVolumeValue"),
      musicSlider: query("musicSlider"),
      leaveMatchButton: query("leaveMatchButton"),
      minimapCanvas: query("minimapCanvas"),
      gameTrackLabel: query("gameTrackLabel"),
      heatCard: query("heatCard"),
      heatFill: query("heatFill"),
      heatValue: query("heatValue"),
      weatherIndicator: query("weatherIndicator"),
      integrityValue: query("integrityValue"),
      qualityValue: query("qualityValue"),
      dashboardCard: query("dashboardCard"),
      dashModeBadge: query("dashModeBadge"),
      modeDual: query("modeDual"),
      modeHybrid: query("modeHybrid"),
      modeDigital: query("modeDigital"),
      modeLcd: query("modeLcd"),
      speedNeedle: query("speedNeedle"),
      rpmNeedle: query("rpmNeedle"),
      speedHybridValue: query("speedHybridValue"),
      rpmHybridNeedle: query("rpmHybridNeedle"),
      rpmHybridValue: query("rpmHybridValue"),
      speedDigitalValue: query("speedDigitalValue"),
      rpmBarFill: query("rpmBarFill"),
      rpmDigitalValue: query("rpmDigitalValue"),
      speedLcdValue: query("speedLcdValue"),
      rpmLcdValue: query("rpmLcdValue"),
      rpmLcdFill: query("rpmLcdFill"),
      rpmLcdFillMirror: query("rpmLcdFillMirror"),
      healthTrack: query("healthTrack"),
      healthFill: query("healthFill"),
      inventoryStack: query("inventoryStack"),
      inventoryFx: query("inventoryFx"),
      slot1Shell: query("slot1Shell"),
      slot1Icon: query("slot1Icon"),
      slot2Shell: query("slot2Shell"),
      slot2Icon: query("slot2Icon"),
      turboShell: query("turboShell"),
      turboIcon: query("turboIcon"),
      turboDots: query("turboDots"),
      turboFx: query("turboFx"),
      controls: query("controls"),
      hostSpectatorButton: this.root.querySelector(
        '[data-weather-action="spectator"]'
      ),
      countdown: query("countdown"),
      countdownValue: query("countdownValue"),
      resultsRoot: query("resultsRoot"),
      resultsTitle: query("resultsTitle"),
      resultsSubtitle: query("resultsSubtitle"),
      resultsTable: query("resultsTable"),
      returnRoot: query("returnRoot"),
      returnText: query("returnText"),
      returnButton: query("returnButton"),
      replayButton: query("replayButton"),
    };

    this.minimapContext = this.refs.minimapCanvas.getContext("2d");
    this.renderInventoryState([]);
    this.applyGameTrackLabel = (label) => {
      if (!this.refs?.gameTrackLabel) return;
      this.refs.gameTrackLabel.textContent = label || "Partida: silencio";
    };
    appAudioManager.setGameTrackLabelListener(this.applyGameTrackLabel);
  }

  attachHandlers() {
    this.weatherButtonHandlers = [];
    const weatherButtons = this.root.querySelectorAll("[data-weather-action]");
    weatherButtons.forEach((button) => {
      const action = String(button.dataset.weatherAction || "").toLowerCase();
      const handler = () => this.onWeatherControl(action);
      button.addEventListener("click", handler);
      this.weatherButtonHandlers.push({ button, handler });
    });

    this.returnButtonHandler = () => {
      const roomType = this.getCurrentRoomType();
      if (roomType !== "public" && this.refs?.returnText) {
        this.refs.returnText.textContent = "Regresando al lobby...";
      }

      if (typeof this.scene.handlePostMatchBackAction === "function") {
        this.scene.handlePostMatchBackAction();
      } else {
        this.scene.requestLobbyReturn?.();
        if (this.refs?.returnText) {
          this.refs.returnText.textContent = "Regresando al lobby...";
        }
      }
    };
    this.refs.returnButton.addEventListener("click", this.returnButtonHandler);
    this.replayButtonHandler = () => {
      if (this.refs?.returnText) {
        this.refs.returnText.textContent = "Buscando sala publica...";
      }
      if (typeof this.scene.playAnotherPublicMatch === "function") {
        this.scene.playAnotherPublicMatch();
      }
    };
    this.refs.replayButton.addEventListener("click", this.replayButtonHandler);

    this.spectatorPrevHandler = () => {
      this.scene.selectNextSpectatorTarget?.(-1);
    };
    this.refs.spectatorPrev.addEventListener("click", this.spectatorPrevHandler);
    this.spectatorNextHandler = () => {
      this.scene.selectNextSpectatorTarget?.(1);
    };
    this.refs.spectatorNext.addEventListener("click", this.spectatorNextHandler);

    this.settingsBackdropHandler = () => this.closeSettingsMenu();
    this.refs.settingsBackdrop.addEventListener("click", this.settingsBackdropHandler);
    this.settingsCloseHandler = () => this.closeSettingsMenu();
    this.refs.settingsClose.addEventListener("click", this.settingsCloseHandler);
    this.settingsSfxMuteHandler = () => {
      appAudioManager.toggleSfxMuted();
      this.syncSettingsAudioUi();
    };
    this.refs.sfxMuteButton.addEventListener("click", this.settingsSfxMuteHandler);
    this.settingsMusicMuteHandler = () => {
      appAudioManager.toggleMusicMuted();
      this.syncSettingsAudioUi();
    };
    this.refs.musicMuteButton.addEventListener("click", this.settingsMusicMuteHandler);
    this.settingsSfxSliderHandler = () => {
      const nextVolume = clamp01(Number(this.refs.sfxSlider.value || 0) / 100);
      appAudioManager.setSfxVolume(nextVolume);
      if (nextVolume > 0 && appAudioManager.getSfxMuted()) {
        appAudioManager.setSfxMuted(false);
      }
      this.syncSettingsAudioUi();
    };
    this.refs.sfxSlider.addEventListener("input", this.settingsSfxSliderHandler);
    this.settingsMusicSliderHandler = () => {
      const nextVolume = clamp01(Number(this.refs.musicSlider.value || 0) / 100);
      appAudioManager.setMusicVolume(nextVolume);
      if (nextVolume > 0 && appAudioManager.getMusicMuted()) {
        appAudioManager.setMusicMuted(false);
      }
      this.syncSettingsAudioUi();
    };
    this.refs.musicSlider.addEventListener("input", this.settingsMusicSliderHandler);
    this.settingsLeaveMatchHandler = () => {
      this.closeSettingsMenu({ silent: true });
      this.scene.leaveCurrentRoom?.({ allowInMatch: true });
    };
    this.refs.leaveMatchButton.addEventListener("click", this.settingsLeaveMatchHandler);

    this.applyDashboardMode();
    this.syncSettingsAudioUi();
    this.closeSettingsMenu({ silent: true });
  }

  syncSettingsAudioUi() {
    const sfxVolume = clamp01(appAudioManager.getSfxVolume());
    const musicVolume = clamp01(appAudioManager.getMusicVolume());
    const sfxMuted = appAudioManager.getSfxMuted();
    const musicMuted = appAudioManager.getMusicMuted();

    this.refs.sfxSlider.value = String(Math.round(sfxVolume * 100));
    this.refs.musicSlider.value = String(Math.round(musicVolume * 100));
    this.refs.sfxVolumeValue.textContent = formatPercent(sfxVolume);
    this.refs.musicVolumeValue.textContent = formatPercent(musicVolume);
    this.syncSettingsMuteButton(this.refs.sfxMuteButton, this.refs.sfxMuteIcon, sfxMuted, {
      muted: "Activar efectos",
      unmuted: "Silenciar efectos",
    });
    this.syncSettingsMuteButton(
      this.refs.musicMuteButton,
      this.refs.musicMuteIcon,
      musicMuted,
      {
        muted: "Activar musica",
        unmuted: "Silenciar musica",
      }
    );
  }

  syncSettingsMuteButton(button, _iconNode, muted, labels = {}) {
    if (!button) return;
    const isMuted = Boolean(muted);
    button.classList.toggle("is-muted", isMuted);
    button.setAttribute("aria-pressed", isMuted ? "true" : "false");
    button.setAttribute(
      "aria-label",
      isMuted ? labels.muted || "Activar" : labels.unmuted || "Silenciar"
    );
  }

  toggleSettingsMenu(forceOpen = null) {
    const nextOpen =
      typeof forceOpen === "boolean" ? forceOpen : !Boolean(this.settingsMenuOpen);
    if (!nextOpen) {
      this.closeSettingsMenu();
      return;
    }
    if (!this.scene.matchRunning || this.scene.matchEnded) return;
    this.syncSettingsAudioUi();
    this.settingsMenuOpen = true;
    this.refs.settingsModal.classList.remove("ghuk-hidden");
    this.refs.settingsModal.setAttribute("aria-hidden", "false");
    this.scene.syncKeyboardCaptureState?.();
  }

  closeSettingsMenu(_options = {}) {
    this.settingsMenuOpen = false;
    if (!this.refs?.settingsModal) return;
    this.refs.settingsModal.classList.add("ghuk-hidden");
    this.refs.settingsModal.setAttribute("aria-hidden", "true");
    const activeElement =
      typeof document !== "undefined" ? document.activeElement : null;
    if (
      activeElement instanceof HTMLElement &&
      this.refs.settingsModal.contains(activeElement)
    ) {
      activeElement.blur();
    }
    this.scene.syncKeyboardCaptureState?.();
  }

  isSettingsMenuOpen() {
    return Boolean(this.settingsMenuOpen);
  }

  updateSettingsAvailability(matchInfo = {}) {
    const canOpen = Boolean(matchInfo.running && !matchInfo.ended);
    if (!canOpen) {
      this.closeSettingsMenu({ silent: true });
    }
  }

  showSystemNotice(message, durationMs = 1500) {
    this.queueBanner(message, "leave", durationMs);
  }

  getCurrentRoomType() {
    const sceneRoomType = this.scene?.currentLobbyState?.roomType;
    if (sceneRoomType) return sceneRoomType;
    return this.scene?.multiplayer?.getRoomInfo?.()?.roomType || "public";
  }

  applyDashboardMode() {
    const modeMeta = getDashboardModeMeta(this.dashboardMode);
    this.dashboardMode = modeMeta.id;
    this.refs.modeDual.classList.toggle("ghuk-hidden", this.dashboardMode !== "dual");
    this.refs.modeHybrid.classList.toggle("ghuk-hidden", this.dashboardMode !== "hybrid");
    this.refs.modeDigital.classList.toggle("ghuk-hidden", this.dashboardMode !== "digital");
    this.refs.modeLcd.classList.toggle("ghuk-hidden", this.dashboardMode !== "lcd");
    this.refs.dashModeBadge.textContent = modeMeta.label;
  }

  updateGaugeNeedle(node, ratio) {
    if (!node) return;
    const clamped = clamp01(ratio);
    const angle =
      DASH_DIAL_ANGLE_START +
      clamped * (DASH_DIAL_ANGLE_END - DASH_DIAL_ANGLE_START);
    node.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
  }

  setMeterSegmentsState(node, ratio) {
    if (!node) return;
    const segments = Array.from(node.children || []);
    if (!segments.length) return;
    const safeRatio = clamp01(ratio);
    const activeCount = Math.max(1, Math.round(segments.length * safeRatio));
    segments.forEach((segment, index) => {
      segment.classList.toggle("is-on", index < activeCount && safeRatio > 0);
    });
  }

  renderSevenSegmentValue(node, value, options = {}) {
    if (!node) return;
    node.innerHTML = buildSevenSegmentDisplayMarkup(value, options);
  }

  triggerDashboardImpact(intensity = 1) {
    if (!this.refs?.dashboardCard) return;
    const safeIntensity = clamp01(intensity);
    this.refs.dashboardCard.style.setProperty("--ghuk-dashboard-hit", safeIntensity.toFixed(3));
    this.restartCssAnimation(this.refs.dashboardCard, "is-impact-hit");
  }

  restartCssAnimation(node, className) {
    if (!node) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  normalizeInventoryItems(inventoryState = {}) {
    if (!Array.isArray(inventoryState.items)) return [];
    return inventoryState.items
      .slice(0, 2)
      .map((entry) => {
        const type = String(entry?.type || "");
        if (!type) return null;
        return {
          type,
          label: entry?.label || getItemLabel(type) || "Item",
        };
      })
      .filter(Boolean);
  }

  setInventoryShell(shellNode, iconNode, entry = null) {
    if (!shellNode || !iconNode) return;

    shellNode.classList.remove("is-arriving-front", "is-arriving-back", "is-promoted");

    const type = String(entry?.type || "");
    const imagePath = getItemImagePath(type);
    if (!type || !imagePath) {
      shellNode.classList.add("is-empty");
      shellNode.removeAttribute("data-item-type");
      iconNode.classList.add("ghuk-hidden");
      iconNode.removeAttribute("src");
      iconNode.alt = "";
      return;
    }

    shellNode.classList.remove("is-empty");
    shellNode.dataset.itemType = type;
    iconNode.src = imagePath;
    iconNode.alt = entry?.label || getItemLabel(type) || "Item";
    iconNode.classList.remove("ghuk-hidden");
  }

  renderInventoryState(items = []) {
    this.setInventoryShell(this.refs.slot1Shell, this.refs.slot1Icon, items[0] || null);
    this.setInventoryShell(this.refs.slot2Shell, this.refs.slot2Icon, items[1] || null);
  }

  spawnConsumedInventoryGhost(entry = null) {
    if (!this.refs?.inventoryFx) return;

    const type = String(entry?.type || "");
    const imagePath = getItemImagePath(type);
    if (!type || !imagePath) return;

    this.refs.inventoryFx.replaceChildren();

    const ghost = document.createElement("div");
    ghost.className = "ghuk-item-shell ghuk-item-shell--primary ghuk-item-shell--fx";
    ghost.dataset.itemType = type;

    const content = document.createElement("div");
    content.className = "ghuk-item-content";

    const icon = document.createElement("img");
    icon.className = "ghuk-item-icon";
    icon.src = imagePath;
    icon.alt = entry?.label || getItemLabel(type) || "Item";
    icon.draggable = false;

    content.appendChild(icon);
    ghost.appendChild(content);
    ghost.addEventListener(
      "animationend",
      () => {
        ghost.remove();
      },
      { once: true }
    );
    this.refs.inventoryFx.appendChild(ghost);
  }

  resetInventoryVisualState() {
    this.lastInventoryItems = [];
    this.lastInventorySignature = null;
    this.hasRenderedInventoryState = false;
    this.refs?.inventoryFx?.replaceChildren();
    this.renderInventoryState([]);
  }

  resetTurboVisualState() {
    this.lastTurboCharges = 0;
    this.lastTurboMaxCharges = 3;
    this.lastTurboSignature = "";
    this.hasRenderedTurboState = false;
    if (!this.refs?.turboShell) return;
    this.refs.turboShell.classList.remove("is-spent", "is-refilled");
    this.refs.turboShell.classList.add("is-empty");
    this.refs?.turboFx?.replaceChildren();
  }

  spawnConsumedTurboGhost() {
    if (!this.refs?.turboFx) return;

    this.refs.turboFx.replaceChildren();

    const ghost = document.createElement("div");
    ghost.className = "ghuk-turbo-shell ghuk-turbo-shell--fx";

    const wrap = document.createElement("div");
    wrap.className = "ghuk-turbo-icon-wrap";

    const diamond = document.createElement("div");
    diamond.className = "ghuk-turbo-diamond";

    const icon = document.createElement("img");
    icon.className = "ghuk-turbo-icon";
    icon.src = TURBO_IMAGE_PATH;
    icon.alt = "Nitro";
    icon.draggable = false;

    diamond.appendChild(icon);
    wrap.appendChild(diamond);
    ghost.appendChild(wrap);
    ghost.addEventListener(
      "animationend",
      () => {
        ghost.remove();
      },
      { once: true }
    );
    this.refs.turboFx.appendChild(ghost);
  }

  onWeatherControl(action) {
    if (!this.scene.matchRunning || this.scene.matchEnded) return;
    if (!this.scene.isLocalHost?.()) return;

    if (action === "clear") return this.scene.multiplayer?.emitClearWeatherEvent?.();
    if (action === "train") return this.scene.multiplayer?.emitStartTrainEvent?.();
    if (action === "spectator") return this.scene.toggleHostSpectatorMode?.();
    if (action === "finish_self") {
      const triggered = this.scene.forceHostDebugReachMeta?.();
      if (triggered) {
        this.queueBanner("Meta forzada (host)", "info", 820);
      }
      return;
    }
    if (action === "grant_turbo") {
      const granted = this.scene.grantHostDebugTurbo?.();
      if (granted) {
        this.queueBanner("Nitro +1", "turbo", 760);
      }
      return;
    }

    if (
      action === WEATHER_EVENT_TYPES.RAIN ||
      action === WEATHER_EVENT_TYPES.SUNNY ||
      action === WEATHER_EVENT_TYPES.NIGHT ||
      action === WEATHER_EVENT_TYPES.EARTHQUAKE
    ) {
      this.scene.multiplayer?.emitQueueWeatherEvent?.(action);
      return;
    }

    const grantMap = {
      grant_oil: ITEM_TYPES.OIL,
      grant_wall: ITEM_TYPES.WALL,
      grant_emp: ITEM_TYPES.EMP,
      grant_shield: ITEM_TYPES.SHIELD,
      grant_ghost: ITEM_TYPES.GHOST,
    };
    const grantType = grantMap[action];
    if (!grantType) return;
    this.scene.multiplayer?.emitGrantItem?.(grantType);
  }

  handleResize(gameSize) {
    const width = Math.max(1, toNumber(gameSize?.width, 1));
    const height = Math.max(1, toNumber(gameSize?.height, 1));

    const canvas = this.refs.minimapCanvas;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const targetWidth = Math.max(120, Math.round((width * 0.18 + 52) * dpr));
    const targetHeight = Math.max(140, Math.round((height * 0.22 + 40) * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    this.redrawMinimap(this.lastMinimapState);
  }

  queueBanner(message, tone = "info", durationMs = 1300) {
    if (!message) return;
    this.refs.banner.textContent = message;
    this.refs.banner.dataset.tone = tone;
    this.refs.banner.classList.remove("ghuk-hidden");
    this.lastBannerUntilMs = this.scene.time.now + Math.max(300, Number(durationMs || 0));
  }

  updateBanner() {
    if (this.scene.time.now <= this.lastBannerUntilMs) return;
    this.refs.banner.classList.add("ghuk-hidden");
  }

  setMinimapData(minimapData) {
    this.minimapData = minimapData || null;
    this.minimapTextureKey = "";
    this.minimapTextureImage = null;
    this.redrawMinimap(this.lastMinimapState);
  }

  getMinimapImage() {
    if (this.minimapData?.type !== "image") return null;
    const textureKey = String(this.minimapData?.textureKey || "");
    if (!textureKey) return null;
    if (this.minimapTextureKey === textureKey && this.minimapTextureImage) {
      return this.minimapTextureImage;
    }

    const texture = this.scene?.textures?.get?.(textureKey);
    const sourceImage = texture?.getSourceImage?.();
    if (!sourceImage) return null;

    this.minimapTextureKey = textureKey;
    this.minimapTextureImage = sourceImage;
    return sourceImage;
  }

  worldToMinimap(worldX, worldY, width, height) {
    const worldWidth = Math.max(1, toNumber(this.minimapData?.worldWidth, 1));
    const worldHeight = Math.max(1, toNumber(this.minimapData?.worldHeight, 1));
    const x = clamp01(toNumber(worldX, 0) / worldWidth);
    const y = clamp01(toNumber(worldY, 0) / worldHeight);
    const padding = Math.max(8, width * 0.04);

    return {
      x: padding + x * (width - padding * 2),
      y: padding + y * (height - padding * 2),
    };
  }

  redrawMinimap(minimapState = {}) {
    this.lastMinimapState = minimapState || {};
    const context = this.minimapContext;
    if (!context) return;

    const canvas = this.refs.minimapCanvas;
    const width = canvas.width;
    const height = canvas.height;
    if (width <= 0 || height <= 0) return;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0b1320";
    context.fillRect(0, 0, width, height);

    const drawPaths = (strokeStyle, lineWidth, lineDash = [], alpha = 1) => {
      const previousAlpha = context.globalAlpha;
      context.globalAlpha = clamp01(alpha);
      context.strokeStyle = strokeStyle;
      context.lineWidth = lineWidth;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.setLineDash(lineDash);
      this.minimapData.paths.forEach((path) => {
        if (!Array.isArray(path) || path.length < 2) return;
        context.beginPath();
        path.forEach((point, index) => {
          const mapped = this.worldToMinimap(point?.x, point?.y, width, height);
          if (index === 0) context.moveTo(mapped.x, mapped.y);
          else context.lineTo(mapped.x, mapped.y);
        });
        context.stroke();
      });
      context.setLineDash([]);
      context.globalAlpha = previousAlpha;
    };

    const minimapImage = this.getMinimapImage();
    if (minimapImage && minimapImage.width > 0 && minimapImage.height > 0) {
      context.imageSmoothingEnabled = true;
      context.drawImage(minimapImage, 0, 0, width, height);
      context.fillStyle = "rgba(7, 14, 24, 0.2)";
      context.fillRect(0, 0, width, height);
    } else if (
      this.minimapData?.type === "paths" &&
      Array.isArray(this.minimapData.paths)
    ) {
      drawPaths("rgba(38, 46, 61, 0.95)", Math.max(3, Math.round(width * 0.03)));
      drawPaths(
        numberColorToCss(this.minimapData.pathColor, "#eff4fb"),
        Math.max(1, Math.round(width * 0.009)),
        [],
        toNumber(this.minimapData.pathAlpha, 0.92)
      );
      drawPaths(
        "rgba(255, 208, 94, 0.74)",
        Math.max(1, Math.round(width * 0.0035)),
        [Math.max(3, width * 0.018), Math.max(3, width * 0.014)]
      );
    } else {
      context.strokeStyle = "rgba(205, 225, 255, 0.22)";
      context.lineWidth = 2;
      context.strokeRect(14, 14, width - 28, height - 28);
    }

    context.strokeStyle = "rgba(205, 225, 255, 0.28)";
    context.lineWidth = Math.max(1, Math.round(width * 0.003));
    context.strokeRect(0.5, 0.5, width - 1, height - 1);

    const objective = minimapState?.objective || null;
    if (objective) {
      const point = this.worldToMinimap(objective.x, objective.y, width, height);
      const objectiveColor = numberColorToCss(objective.color, "#ffd56a");
      const pulse = 0.9 + Math.sin(this.scene.time.now * 0.012) * 0.2;
      const objectiveRadius = Math.max(4, width * 0.014);
      context.fillStyle = "rgba(0, 0, 0, 0.35)";
      context.beginPath();
      context.arc(point.x, point.y, objectiveRadius * 1.65, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = objectiveColor;
      context.beginPath();
      context.arc(point.x, point.y, objectiveRadius * pulse, 0, Math.PI * 2);
      context.fill();
    }

    const remotePlayers = Array.isArray(minimapState?.remotePlayers)
      ? minimapState.remotePlayers
      : [];
    remotePlayers.forEach((player) => {
      const point = this.worldToMinimap(player?.x, player?.y, width, height);
      context.fillStyle = "rgba(104, 196, 255, 0.95)";
      context.beginPath();
      context.arc(point.x, point.y, Math.max(3, width * 0.011), 0, Math.PI * 2);
      context.fill();
    });

    const localPlayer = minimapState?.localPlayer;
    if (localPlayer) {
      const point = this.worldToMinimap(localPlayer.x, localPlayer.y, width, height);
      const marker = Math.max(5, width * 0.016);
      context.save();
      context.translate(point.x, point.y);
      context.rotate(localPlayer.angle || 0);
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.moveTo(marker * 1.5, 0);
      context.lineTo(-marker * 0.82, marker * 0.88);
      context.lineTo(-marker * 0.82, -marker * 0.88);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  flashNode(node) {
    if (!node) return;
    node.classList.remove("ghuk-status-glow");
    window.requestAnimationFrame(() => {
      node.classList.add("ghuk-status-glow");
    });
  }

  updateCallouts(deliveryData, timing, motoInfo) {
    const currentOrderCount = toNumber(deliveryData.currentOrder, 0);
    const packageHealth = toNumber(deliveryData.packageHealthPercent, 100);
    const weatherType = String(motoInfo.weatherEventType || WEATHER_EVENT_TYPES.NONE);
    const countdownLabel = String(timing.countdownLabel || "");

    if (currentOrderCount > this.lastOrderCount) {
      this.queueBanner("Objective Completed", "success", 1300);
      this.flashNode(this.refs.orderText);
    }

    if (packageHealth < this.lastPackageHealth - 5) {
      this.queueBanner("Package Taking Damage", bannerToneFromHealthDrop(packageHealth), 1100);
      this.flashNode(this.refs.integrityValue);
    }

    if (Boolean(motoInfo.turbo?.active) && !this.lastTurboActive) {
      this.queueBanner("Turbo Activated", "turbo", 900);
    }

    const isCooling = Boolean(motoInfo.heat?.cooling);
    if (isCooling && !this.lastHeatCooling) {
      this.queueBanner("Engine Cooling", "warning", 1000);
    }

    if (weatherType !== this.lastWeatherType) {
      this.queueBanner(`Weather: ${weatherChip(weatherType)}`, "info", 1000);
    }

    if (countdownLabel && countdownLabel !== this.lastCountdownLabel) {
      this.queueBanner(`Start ${countdownLabel}`, "warning", 700);
    }

    const finishWindowRemainingMs = toNumber(timing.finishWindowRemainingMs, 0);
    if (finishWindowRemainingMs > 0) {
      const seconds = Math.max(0, Math.ceil(finishWindowRemainingMs / 1000));
      if (seconds !== this.lastFinishCallSecond && FINISH_CALL_SECONDS.has(seconds)) {
        this.queueBanner(`Finish Window ${seconds}s`, "danger", 700);
      }
      this.lastFinishCallSecond = seconds;
    } else {
      this.lastFinishCallSecond = -1;
    }

    this.lastOrderCount = currentOrderCount;
    this.lastPackageHealth = packageHealth;
    this.lastTurboActive = Boolean(motoInfo.turbo?.active);
    this.lastHeatCooling = isCooling;
    this.lastWeatherType = weatherType;
    this.lastCountdownLabel = countdownLabel;
  }

  updateWeatherPresentation(motoInfo, weatherEvent) {
    const weatherType = String(motoInfo.weatherEventType || WEATHER_EVENT_TYPES.NONE);
    this.refs.overlay.dataset.weather = weatherType;
    this.refs.rainGlass?.classList.toggle(
      "is-active",
      weatherType === WEATHER_EVENT_TYPES.RAIN
    );
    this.refs.weatherIndicator.textContent = weatherChip(weatherType);

    const hasWeatherEvent = weatherEvent?.type && weatherEvent.type !== WEATHER_EVENT_TYPES.NONE;
    if (!hasWeatherEvent || !this.scene.matchRunning) {
      this.refs.weatherEventText.classList.add("ghuk-hidden");
      return;
    }

    const nowMs = Date.now();
    let label = weatherEvent.label || weatherLabel(weatherType);
    if (weatherEvent.phase === "countdown") {
      const remainingSeconds = Math.max(0, Math.ceil((weatherEvent.startsAtMs - nowMs) / 1000));
      label = `${label} in ${remainingSeconds}s`;
    } else {
      const remainingSeconds = Math.max(0, Math.ceil((weatherEvent.endsAtMs - nowMs) / 1000));
      const isEarthquake =
        weatherType === WEATHER_EVENT_TYPES.EARTHQUAKE;
      label = isEarthquake
        ? `${label} | ${remainingSeconds}s`
        : `${label} active ${remainingSeconds}s`;
    }

    this.refs.weatherEventText.textContent = label;
    this.refs.weatherEventText.classList.remove("ghuk-hidden");
  }

  updateHeat(heatInfo = {}, weatherType = WEATHER_EVENT_TYPES.NONE) {
    const isSunnyMode =
      String(weatherType || WEATHER_EVENT_TYPES.NONE) === WEATHER_EVENT_TYPES.SUNNY &&
      Boolean(heatInfo.active);
    this.refs.heatCard.classList.toggle("ghuk-hidden", !isSunnyMode);
    if (!isSunnyMode) return;

    const heatPercent = clamp01(heatInfo.percent);
    this.refs.heatFill.style.height = `${Math.max(2, heatPercent * 100)}%`;
    this.refs.heatValue.textContent = `${Math.round(heatPercent * 100)}%`;
    this.refs.heatValue.style.color = heatInfo.cooling
      ? "#8bd8ff"
      : heatPercent >= 0.82
        ? "#ff8574"
        : "#ebf6ff";
  }

  updateRaceStatus(deliveryData = {}, timing = {}) {
    const currentOrder = toNumber(deliveryData.currentOrder, 0);
    const totalOrders = toNumber(deliveryData.totalOrders, 0);
    const destination = String(deliveryData.destination || "Looking for route...");
    const shortDestination =
      destination.length > 58 ? `${destination.slice(0, 55)}...` : destination;

    this.refs.orderText.textContent = `Order ${currentOrder}/${totalOrders}`;
    this.refs.destinationText.textContent = `Destination: ${shortDestination}`;

    const finishWindow = toNumber(timing.finishWindowRemainingMs, 0);
    if (timing.countdownLabel) {
      this.refs.timerText.textContent = `Start ${timing.countdownLabel}`;
      this.refs.timerText.style.color = "#ffffff";
    } else if (finishWindow > 0) {
      const remaining = Math.max(0, finishWindow / 1000).toFixed(1);
      this.refs.timerText.textContent = `Close ${remaining}s`;
      this.refs.timerText.style.color = "#ffb0a8";
    } else {
      this.refs.timerText.textContent = formatRaceTime(toNumber(timing.elapsedMs, 0));
      this.refs.timerText.style.color = "#ffffff";
    }
  }

  updatePackage(deliveryData = {}) {
    const health = toNumber(deliveryData.packageHealthPercent, 0);
    const quality = toNumber(deliveryData.qualityPercent, 0);
    const integrityColor =
      health <= 25
        ? "#ff746d"
        : health <= 50
          ? "#ffbe5c"
          : deliveryData.packageHealthColor || "#58d48f";

    this.refs.integrityValue.textContent = `${Math.max(0, Math.round(health))}%`;
    this.refs.integrityValue.style.color = integrityColor;
    this.refs.qualityValue.textContent = `Average Quality: ${Math.max(0, Math.round(quality))}%`;
    this.refs.qualityValue.style.color = quality < 50 ? "#ffcc9d" : "#d6eaff";
  }

  updateDashboard(moto, motoInfo = {}) {
    const speedKmh = Math.max(0, Math.round(speedPxPerSecToKmh(toNumber(moto?.speedPxPerSec, 0))));
    const speedRatio =
      moto && moto.maxSpeedPxPerSec > 0
        ? clamp01(moto.speedPxPerSec / moto.maxSpeedPxPerSec)
        : 0;
    const hudSpeedRatio = clamp01(speedKmh / HUD_MAX_SPEED_KMH);
    const rpmBase = 1000 + speedRatio * 8400;
    const rpmPulse = Math.sin(this.scene.time.now * 0.011) * 140;
    const rpm = Math.max(1000, Math.round(rpmBase + rpmPulse));
    const rpmRatio = clamp01((rpm - 1000) / 9000);
    const healthPercent = toNumber(motoInfo.healthPercent, 100);
    const repairing = Boolean(motoInfo.repairing);
    const repairRemainingMs = Math.max(0, toNumber(motoInfo.repairRemainingMs, 0));
    const repairDurationMs = Math.max(1, toNumber(motoInfo.repairDurationMs, 1800));
    const repairProgress = repairing
      ? clamp01(1 - repairRemainingMs / repairDurationMs)
      : 0;
    const damageRatio = repairing
      ? clamp01((1 - healthPercent / 100) * (1 - repairProgress))
      : clamp01(1 - healthPercent / 100);
    const healthColor =
      healthPercent <= 25
        ? "#ff746d"
        : healthPercent <= 50
          ? "#ffbe5c"
          : motoInfo.healthColor || "#58d48f";
    const healthVisualRatio = repairing ? repairProgress : clamp01(healthPercent / 100);
    const healthDrop = Math.max(0, this.lastMotoHealthPercent - healthPercent);

    this.updateGaugeNeedle(this.refs.speedNeedle, hudSpeedRatio);
    this.updateGaugeNeedle(this.refs.rpmNeedle, rpmRatio);
    this.updateGaugeNeedle(this.refs.rpmHybridNeedle, rpmRatio);

    this.renderSevenSegmentValue(this.refs.speedHybridValue, formatDashboardSpeed(speedKmh), {
      digits: 3,
      className: "ghuk-7seg-display--hybrid",
    });
    this.refs.rpmHybridValue.textContent = formatDashboardRpmCompact(rpm);
    this.renderSevenSegmentValue(this.refs.speedDigitalValue, formatDashboardSpeed(speedKmh), {
      digits: 3,
      className: "ghuk-7seg-display--digital",
    });
    this.refs.rpmDigitalValue.textContent = formatDashboardRpmCompact(rpm);
    this.setMeterSegmentsState(this.refs.rpmBarFill, rpmRatio);
    this.refs.speedLcdValue.textContent = `${speedKmh}`;
    this.refs.rpmLcdValue.textContent = formatDashboardRpmShort(rpm);
    this.refs.rpmLcdFill.style.height = `${Math.max(8, rpmRatio * 100)}%`;
    this.refs.rpmLcdFillMirror.style.height = `${Math.max(8, rpmRatio * 100)}%`;

    this.refs.dashboardCard.classList.toggle("is-repairing", repairing);
    this.refs.dashboardCard.classList.remove("is-turbo-active", "is-overdrive");
    this.refs.dashboardCard.style.setProperty("--ghuk-dashboard-damage", damageRatio.toFixed(3));
    this.refs.dashboardCard.style.setProperty("--ghuk-dashboard-boost", "0");
    this.refs.dashboardCard.style.setProperty("--ghuk-dashboard-speed", hudSpeedRatio.toFixed(3));
    this.refs.dashboardCard.style.setProperty("--ghuk-dashboard-rpm", rpmRatio.toFixed(3));
    this.refs.dashboardCard.style.setProperty("--ghuk-dashboard-fire", "0");
    this.refs.dashboardCard.style.setProperty("--ghuk-dashboard-burst", "0");
    if (healthDrop >= 1 && !repairing) {
      this.triggerDashboardImpact(Math.min(1, healthDrop / 12));
    }

    this.refs.healthTrack.classList.toggle("is-repairing", repairing);
    this.refs.healthTrack.style.setProperty("--ghuk-health-color", repairing ? "#6fd6ff" : healthColor);
    this.refs.healthFill.style.width = `${Math.max(0, healthVisualRatio * 100)}%`;
    this.lastMotoHealthPercent = repairing ? 0 : healthPercent;
    this.lastRepairing = repairing;
  }

  updateInventory(inventoryState = {}) {
    const items = this.normalizeInventoryItems(inventoryState);
    const signature = items.map((entry) => entry.type).join("|");
    if (signature === this.lastInventorySignature) return;

    if (!this.hasRenderedInventoryState) {
      this.renderInventoryState(items);
      this.lastInventoryItems = items;
      this.lastInventorySignature = signature;
      this.hasRenderedInventoryState = true;
      return;
    }

    const previousItems = this.lastInventoryItems;
    const consumedPrimary =
      Boolean(previousItems[0]?.type) &&
      (previousItems.length > items.length ||
        previousItems[0]?.type !== items[0]?.type);
    const secondaryPromoted =
      Boolean(previousItems[1]?.type) &&
      Boolean(items[0]?.type) &&
      previousItems.length > items.length &&
      previousItems[1].type === items[0].type;
    const newPrimaryArrived =
      Boolean(items[0]?.type) &&
      (!previousItems[0]?.type ||
        (!secondaryPromoted && previousItems[0].type !== items[0].type));
    const newSecondaryArrived =
      Boolean(items[1]?.type) &&
      (!previousItems[1]?.type || previousItems[1].type !== items[1].type);

    if (consumedPrimary) {
      this.spawnConsumedInventoryGhost(previousItems[0]);
    } else {
      this.refs.inventoryFx.replaceChildren();
    }

    this.renderInventoryState(items);

    if (secondaryPromoted) {
      this.restartCssAnimation(this.refs.slot1Shell, "is-promoted");
    } else if (newPrimaryArrived) {
      this.restartCssAnimation(this.refs.slot1Shell, "is-arriving-front");
    }

    if (newSecondaryArrived) {
      this.restartCssAnimation(this.refs.slot2Shell, "is-arriving-back");
    }

    this.lastInventoryItems = items;
    this.lastInventorySignature = signature;
    this.hasRenderedInventoryState = true;
  }

  updateTurbo(stockState = {}) {
    const charges = Math.max(0, toNumber(stockState.turboCharges, 0));
    const maxCharges = Math.max(1, toNumber(stockState.turboMaxCharges, 3));
    const signature = `${charges}/${maxCharges}`;
    if (signature === this.lastTurboSignature) return;

    this.refs.turboShell.classList.remove("is-spent", "is-refilled");
    if (this.hasRenderedTurboState && charges !== this.lastTurboCharges) {
      const animationClass = charges < this.lastTurboCharges ? "is-spent" : "is-refilled";
      if (charges < this.lastTurboCharges) {
        this.spawnConsumedTurboGhost();
      }
      this.restartCssAnimation(this.refs.turboShell, animationClass);
    }

    this.refs.turboShell.classList.toggle("is-empty", charges <= 0);
    const dots = Array.from(this.refs.turboDots.querySelectorAll(".ghuk-turbo-dot"));
    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index < charges);
      dot.classList.toggle("ghuk-hidden", index >= maxCharges);
    });

    this.lastTurboCharges = charges;
    this.lastTurboMaxCharges = maxCharges;
    this.lastTurboSignature = signature;
    this.hasRenderedTurboState = true;
  }

  updateCountdown(timing = {}) {
    const label = String(timing.countdownLabel || "");
    if (!label) {
      this.refs.countdown.classList.add("ghuk-hidden");
      return;
    }

    if (this.refs.countdownValue.textContent !== label) {
      this.refs.countdownValue.textContent = label;
      this.refs.countdownValue.style.animation = "none";
      void this.refs.countdownValue.offsetHeight;
      this.refs.countdownValue.style.animation = "";
    }
    this.refs.countdown.classList.remove("ghuk-hidden");
  }

  updateHostControls(matchInfo = {}) {
    const hostVisible = Boolean(
      matchInfo.isHost &&
        matchInfo.running &&
        !matchInfo.ended
    );
    this.refs.controls.classList.toggle("ghuk-hidden", !hostVisible);

    if (!this.refs.hostSpectatorButton) return;
    const spectatorDebugActive = Boolean(
      this.scene.spectatorModeActive && this.scene.spectatorDebugOverride
    );
    this.refs.hostSpectatorButton.classList.toggle(
      "is-active",
      spectatorDebugActive
    );
    this.refs.hostSpectatorButton.textContent = spectatorDebugActive
      ? "Salir esp."
      : "Espectador";
  }

  updateReturnPanel(matchInfo = {}) {
    const shouldShow = Boolean(matchInfo.ended);
    this.refs.returnRoot.classList.toggle("ghuk-hidden", !shouldShow);
    if (!shouldShow) return;

    const isPublicMatch = this.getCurrentRoomType() === "public";
    this.refs.returnButton.textContent = isPublicMatch
      ? "Regresar"
      : "Regresar al lobby";
    this.refs.replayButton.classList.toggle("ghuk-hidden", !isPublicMatch);

    if (isPublicMatch) {
      this.refs.returnText.textContent = "Partida publica finalizada.";
      return;
    }

    const remainingMs = matchInfo.lobbyReturnAtMs
      ? Math.max(0, matchInfo.lobbyReturnAtMs - Date.now())
      : 0;
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    this.refs.returnText.textContent =
      remainingSeconds > 0
        ? `Regreso al lobby en ${remainingSeconds}s`
        : "Regreso al lobby en curso...";
  }

  resetTransientSignals() {
    this.lastOrderCount = 0;
    this.lastPackageHealth = 100;
    this.lastMotoHealthPercent = 100;
    this.lastRepairing = false;
    this.lastTurboActive = false;
    this.lastHeatCooling = false;
    this.lastWeatherType = WEATHER_EVENT_TYPES.NONE;
    this.lastCountdownLabel = "";
    this.lastFinishCallSecond = -1;
    this.resetInventoryVisualState();
    this.resetTurboVisualState();
  }

  updateSpectatorPanel(spectatorInfo = {}, matchInfo = {}) {
    const spectatorActive = Boolean(
      spectatorInfo.active && matchInfo.running && !matchInfo.ended
    );
    this.refs.spectatorRoot.classList.toggle("ghuk-hidden", !spectatorActive);
    this.root.classList.toggle(
      "ghuk-root--spectator-finished",
      spectatorActive && Boolean(spectatorInfo.targetFinished)
    );

    if (!spectatorActive) {
      this.lastSpectatorTargetId = "";
      this.refs.spectatorStatus.classList.add("ghuk-hidden");
      this.refs.spectatorPrev.disabled = false;
      this.refs.spectatorNext.disabled = false;
      return;
    }

    const targetId = String(spectatorInfo.targetId || "");
    if (targetId && targetId !== this.lastSpectatorTargetId) {
      this.lastSpectatorTargetId = targetId;
      this.resetTransientSignals();
      this.refs.banner.classList.add("ghuk-hidden");
    }

    this.refs.spectatorName.textContent = String(
      spectatorInfo.targetName || "Jugador"
    );
    this.refs.spectatorStatus.classList.toggle(
      "ghuk-hidden",
      !Boolean(spectatorInfo.targetFinished)
    );

    const canNavigate = Boolean(spectatorInfo.canNavigate);
    this.refs.spectatorPrev.disabled = !canNavigate;
    this.refs.spectatorNext.disabled = !canNavigate;
  }

  update(moto, _delta, info = {}) {
    if (!this.visible) return;

    const deliveryData = info.delivery || {};
    const timing = info.timing || {};
    const motoInfo = info.moto || {};
    const weatherEvent = info.weatherEvent || null;
    const inventoryState = info.inventory || {};
    const stockState = info.stock || {};
    const minimapState = info.minimap || {};
    const matchInfo = info.match || {};
    const spectatorInfo = info.spectator || {};
    const spectatorFinishedTarget = Boolean(
      spectatorInfo.active && spectatorInfo.targetFinished
    );

    this.updateSpectatorPanel(spectatorInfo, matchInfo);

    if (!spectatorFinishedTarget) {
      this.updateRaceStatus(deliveryData, timing);
      this.updatePackage(deliveryData);
      this.updateDashboard(moto, motoInfo);
      this.updateHeat(motoInfo.heat || {}, motoInfo.weatherEventType);
      this.updateInventory(inventoryState);
      this.updateTurbo(stockState);
      this.updateCountdown(timing);
      this.updateWeatherPresentation(motoInfo, weatherEvent);
    } else {
      this.refs.countdown.classList.add("ghuk-hidden");
      this.refs.weatherEventText.classList.add("ghuk-hidden");
      this.refs.banner.classList.add("ghuk-hidden");
    }

    this.updateSettingsAvailability(matchInfo);
    this.updateHostControls(matchInfo);
    this.updateReturnPanel(matchInfo);

    if (!spectatorFinishedTarget) {
      this.updateCallouts(deliveryData, timing, motoInfo);
    }

    this.updateBanner();

    if (!spectatorFinishedTarget) {
      this.redrawMinimap(minimapState);
    }
  }

  showResults(results = [], winnerId = null, selfId = null) {
    const rows = Array.isArray(results) ? results : [];
    const selfWinner = Boolean(winnerId && selfId && winnerId === selfId);
    this.root.classList.remove("ghuk-root--spectator-finished");
    this.refs.spectatorRoot.classList.add("ghuk-hidden");

    this.refs.resultsTitle.textContent = selfWinner ? "Victory" : "Final Results";
    this.refs.resultsTitle.style.color = selfWinner ? "#a9f2c4" : "#ffd5ae";
    this.refs.resultsSubtitle.textContent = "Delivery quality + speed ranking";

    const header = `
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Points</th>
          <th>Diff</th>
          <th>Time</th>
          <th>Quality</th>
        </tr>
      </thead>
    `;

    const bodyRows = rows
      .map((entry, index) => {
        const position = index + 1;
        const isWinner = winnerId && entry.id === winnerId;
        const isSelf = selfId && entry.id === selfId;
        const rowClass = `${isWinner ? "winner" : ""} ${isSelf ? "self" : ""}`.trim();
        const points = Number.isFinite(entry.score) ? entry.score : 0;
        const diff = entry.didFinish ? `+${toNumber(entry.timeDeltaSeconds, 0)}s` : "DNF";
        const time = entry.didFinish ? `${(toNumber(entry.elapsedMs, 0) / 1000).toFixed(2)}s` : "DNF";
        const quality = Number.isFinite(entry.qualityPercent) ? `${entry.qualityPercent}%` : "-";

        return `
          <tr class="${rowClass}">
            <td>${position}</td>
            <td>${escapeHtml(entry.name || "Player")}</td>
            <td>${points}</td>
            <td>${escapeHtml(diff)}</td>
            <td>${escapeHtml(time)}</td>
            <td>${escapeHtml(quality)}</td>
          </tr>
        `;
      })
      .join("");

    this.refs.resultsTable.innerHTML = `${header}<tbody>${bodyRows}</tbody>`;
    this.refs.resultsRoot.classList.remove("ghuk-hidden");
    this.queueBanner(selfWinner ? "You Won" : "Match Finished", selfWinner ? "success" : "warning", 1600);
  }

  hideResults() {
    this.refs.resultsRoot.classList.add("ghuk-hidden");
    this.root.classList.remove("ghuk-root--spectator-finished");
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    if (!this.visible) {
      this.closeSettingsMenu({ silent: true });
    }
    this.root.style.display = this.visible ? "block" : "none";
  }

  getHudObjects() {
    return [];
  }

  destroy() {
    this.scene.scale.off("resize", this.handleResize, this);
    appAudioManager.setGameTrackLabelListener(null);
    this.closeSettingsMenu({ silent: true });
    this.weatherButtonHandlers.forEach(({ button, handler }) => {
      button.removeEventListener("click", handler);
    });
    this.weatherButtonHandlers = [];

    this.refs.settingsBackdrop.removeEventListener("click", this.settingsBackdropHandler);
    this.settingsBackdropHandler = null;
    this.refs.settingsClose.removeEventListener("click", this.settingsCloseHandler);
    this.settingsCloseHandler = null;
    this.refs.sfxMuteButton.removeEventListener("click", this.settingsSfxMuteHandler);
    this.settingsSfxMuteHandler = null;
    this.refs.musicMuteButton.removeEventListener("click", this.settingsMusicMuteHandler);
    this.settingsMusicMuteHandler = null;
    this.refs.sfxSlider.removeEventListener("input", this.settingsSfxSliderHandler);
    this.settingsSfxSliderHandler = null;
    this.refs.musicSlider.removeEventListener("input", this.settingsMusicSliderHandler);
    this.settingsMusicSliderHandler = null;
    this.refs.leaveMatchButton.removeEventListener(
      "click",
      this.settingsLeaveMatchHandler
    );
    this.settingsLeaveMatchHandler = null;

    this.refs.returnButton.removeEventListener("click", this.returnButtonHandler);
    this.returnButtonHandler = null;
    this.refs.replayButton.removeEventListener("click", this.replayButtonHandler);
    this.replayButtonHandler = null;
    this.refs.spectatorPrev.removeEventListener("click", this.spectatorPrevHandler);
    this.spectatorPrevHandler = null;
    this.refs.spectatorNext.removeEventListener("click", this.spectatorNextHandler);
    this.spectatorNextHandler = null;

    this.refs.inventoryFx.replaceChildren();
    this.root.remove();
    this.root = null;
    this.refs = null;
    this.minimapContext = null;
  }
}
