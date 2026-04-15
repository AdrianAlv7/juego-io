import "./hud.css";
import { WEATHER_EVENT_TYPES } from "../events/weather/catalog.js";
import { getItemLabel, ITEM_TYPES } from "../items/catalog.js";
import appAudioManager from "./AppAudioManager.js";
import { speedPxPerSecToKmh } from "../world/race/utils/telemetry.js";
import { formatRaceTime } from "./hud/formatters.js";

const FINISH_CALL_SECONDS = new Set([20, 15, 10, 5, 3, 2, 1]);
const DASHBOARD_MODE_SEQUENCE = ["dual", "hybrid", "digital"];
const DASHBOARD_MODE_LABEL = Object.freeze({
  dual: "Dual Analog",
  hybrid: "Hybrid",
  digital: "Full Digital",
});
const SETTINGS_AUDIO_ICONS = Object.freeze({
  music:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 3v12.55A4 4 0 1 1 14 12V7.2l-6 1.4v6.9A4 4 0 1 1 6 12V7l10-4z"/></svg>',
  sfx:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 10.5V13.5H7.25L12 18V6L7.25 10.5H3ZM15.5 9.25A4.25 4.25 0 0 1 15.5 14.75L16.9 16.15A6.2 6.2 0 0 0 16.9 7.85L15.5 9.25ZM18.3 6.45A8.15 8.15 0 0 1 18.3 17.55L19.7 18.95A10.1 10.1 0 0 0 19.7 5.05L18.3 6.45Z"/></svg>',
});

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

function weatherLabel(type) {
  switch (String(type || "").toLowerCase()) {
    case WEATHER_EVENT_TYPES.RAIN:
      return "Heavy Rain";
    case WEATHER_EVENT_TYPES.SUNNY:
      return "Sunny Weather";
    case WEATHER_EVENT_TYPES.NIGHT:
      return "Night Event";
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
    this.lastMinimapState = {
      localPlayer: null,
      remotePlayers: [],
      objective: null,
    };
    this.minimapTextureKey = "";
    this.minimapTextureImage = null;
    this.dashboardMode = "dual";
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

      <section class="ghuk-card ghuk-dashboard">
        <div class="ghuk-dashboard-top">
          <div class="header">Motorcycle Dashboard</div>
          <button class="ghuk-dash-mode-btn" data-ref="dashModeBtn">Mode: Dual Analog</button>
        </div>

        <div class="ghuk-dash-mode ghuk-dash-mode-dual" data-ref="modeDual">
          <div class="ghuk-gauge-block">
            <div class="ghuk-gauge">
              <div class="ghuk-gauge-needle" data-ref="speedNeedle"></div>
              <div class="ghuk-gauge-center"></div>
            </div>
            <div class="ghuk-gauge-caption">Speed</div>
            <div class="ghuk-gauge-number" data-ref="speedGaugeValue">0 km/h</div>
          </div>
          <div class="ghuk-gauge-block">
            <div class="ghuk-gauge">
              <div class="ghuk-gauge-needle ghuk-gauge-needle-rpm" data-ref="rpmNeedle"></div>
              <div class="ghuk-gauge-center"></div>
            </div>
            <div class="ghuk-gauge-caption">RPM</div>
            <div class="ghuk-gauge-number" data-ref="rpmGaugeValue">1000</div>
          </div>
        </div>

        <div class="ghuk-dash-mode ghuk-dash-mode-hybrid ghuk-hidden" data-ref="modeHybrid">
          <div class="ghuk-hybrid-speed">
            <div class="ghuk-speed" data-ref="speedHybridValue">0</div>
            <div class="ghuk-speed-unit">km/h</div>
          </div>
          <div class="ghuk-gauge-block ghuk-gauge-block-hybrid">
            <div class="ghuk-gauge">
              <div class="ghuk-gauge-needle ghuk-gauge-needle-rpm" data-ref="rpmHybridNeedle"></div>
              <div class="ghuk-gauge-center"></div>
            </div>
            <div class="ghuk-gauge-caption">RPM</div>
            <div class="ghuk-gauge-number" data-ref="rpmHybridValue">1000</div>
          </div>
        </div>

        <div class="ghuk-dash-mode ghuk-dash-mode-digital ghuk-hidden" data-ref="modeDigital">
          <div class="ghuk-digital-speed" data-ref="speedDigitalValue">0</div>
          <div class="ghuk-digital-unit">km/h</div>
          <div class="ghuk-rpm-bar-track">
            <div class="ghuk-rpm-bar-fill" data-ref="rpmBarFill"></div>
          </div>
          <div class="ghuk-rpm-text" data-ref="rpmDigitalValue">1000 RPM</div>
        </div>

        <div class="ghuk-dash-meta">
          <div class="label">Health</div><div class="value" data-ref="motoHealthValue">100%</div>
          <div class="label">Repair</div><div class="value" data-ref="repairValue">Ready</div>
        </div>
      </section>

      <section class="ghuk-card ghuk-inventory">
        <div class="ghuk-inventory-title">Inventory</div>
        <div class="ghuk-inventory-slot empty" data-ref="slot1">Slot 1: Empty</div>
        <div class="ghuk-inventory-slot empty" data-ref="slot2">Slot 2: Empty</div>
        <div class="ghuk-drop-hint">Drop key: Z</div>
      </section>

      <section class="ghuk-card ghuk-turbo">
        <div class="ghuk-turbo-title">Turbo Resource</div>
        <div class="ghuk-turbo-dots" data-ref="turboDots">
          <span class="ghuk-turbo-dot"></span>
          <span class="ghuk-turbo-dot"></span>
          <span class="ghuk-turbo-dot"></span>
        </div>
      </section>

      <section class="ghuk-card ghuk-controls ghuk-hidden" data-ref="controls">
        <div class="ghuk-controls-title">Host Controls (Test)</div>
        <div class="ghuk-controls-group-title">Clima / Mapa</div>
        <div class="ghuk-controls-grid">
          <button class="ghuk-btn" data-weather-action="rain" data-tone="rain">Lluvia</button>
          <button class="ghuk-btn" data-weather-action="sunny" data-tone="sunny">Soleado</button>
          <button class="ghuk-btn" data-weather-action="night" data-tone="night">Noche</button>
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
      dashModeBtn: query("dashModeBtn"),
      modeDual: query("modeDual"),
      modeHybrid: query("modeHybrid"),
      modeDigital: query("modeDigital"),
      speedNeedle: query("speedNeedle"),
      rpmNeedle: query("rpmNeedle"),
      speedGaugeValue: query("speedGaugeValue"),
      rpmGaugeValue: query("rpmGaugeValue"),
      speedHybridValue: query("speedHybridValue"),
      rpmHybridNeedle: query("rpmHybridNeedle"),
      rpmHybridValue: query("rpmHybridValue"),
      speedDigitalValue: query("speedDigitalValue"),
      rpmBarFill: query("rpmBarFill"),
      rpmDigitalValue: query("rpmDigitalValue"),
      motoHealthValue: query("motoHealthValue"),
      repairValue: query("repairValue"),
      slot1: query("slot1"),
      slot2: query("slot2"),
      turboDots: query("turboDots"),
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

    const savedMode =
      window.localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_DASHBOARD_MODE_STORAGE_KEY);
    if (DASHBOARD_MODE_SEQUENCE.includes(savedMode)) {
      this.dashboardMode = savedMode;
    }
    this.dashboardModeButtonHandler = () => this.cycleDashboardMode();
    this.refs.dashModeBtn.addEventListener("click", this.dashboardModeButtonHandler);
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

  cycleDashboardMode() {
    const currentIndex = DASHBOARD_MODE_SEQUENCE.indexOf(this.dashboardMode);
    const nextIndex = (Math.max(0, currentIndex) + 1) % DASHBOARD_MODE_SEQUENCE.length;
    this.dashboardMode = DASHBOARD_MODE_SEQUENCE[nextIndex];
    this.applyDashboardMode();
    window.localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, this.dashboardMode);
  }

  applyDashboardMode() {
    this.refs.modeDual.classList.toggle("ghuk-hidden", this.dashboardMode !== "dual");
    this.refs.modeHybrid.classList.toggle("ghuk-hidden", this.dashboardMode !== "hybrid");
    this.refs.modeDigital.classList.toggle("ghuk-hidden", this.dashboardMode !== "digital");
    this.refs.dashModeBtn.textContent = `Mode: ${DASHBOARD_MODE_LABEL[this.dashboardMode] || "Dual Analog"}`;
  }

  updateGaugeNeedle(node, ratio) {
    if (!node) return;
    const clamped = clamp01(ratio);
    const angle = -130 + clamped * 260;
    node.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
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
      action === WEATHER_EVENT_TYPES.NIGHT
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
      label = `${label} active ${remainingSeconds}s`;
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
    const rpmBase = 1000 + speedRatio * 8400;
    const rpmPulse = Math.sin(this.scene.time.now * 0.011) * 140;
    const rpm = Math.max(1000, Math.round(rpmBase + rpmPulse));
    const healthPercent = toNumber(motoInfo.healthPercent, 100);

    this.updateGaugeNeedle(this.refs.speedNeedle, speedKmh / 220);
    this.updateGaugeNeedle(this.refs.rpmNeedle, (rpm - 1000) / 9000);
    this.updateGaugeNeedle(this.refs.rpmHybridNeedle, (rpm - 1000) / 9000);

    this.refs.speedGaugeValue.textContent = `${speedKmh} km/h`;
    this.refs.rpmGaugeValue.textContent = `${rpm}`;
    this.refs.speedHybridValue.textContent = `${speedKmh}`;
    this.refs.rpmHybridValue.textContent = `${rpm}`;
    this.refs.speedDigitalValue.textContent = `${speedKmh}`;
    this.refs.rpmDigitalValue.textContent = `${rpm} RPM`;
    this.refs.rpmBarFill.style.width = `${Math.max(4, clamp01((rpm - 1000) / 9000) * 100)}%`;

    this.refs.motoHealthValue.textContent = `${Math.max(0, Math.round(healthPercent))}%`;
    this.refs.motoHealthValue.style.color =
      healthPercent <= 25
        ? "#ff746d"
        : healthPercent <= 50
          ? "#ffbe5c"
          : motoInfo.healthColor || "#58d48f";

    if (motoInfo.repairing) {
      const remainingSec = Math.max(0, Math.ceil(toNumber(motoInfo.repairRemainingMs, 0) / 1000));
      this.refs.repairValue.textContent = `${remainingSec}s`;
      this.refs.repairValue.style.color = "#ffbf85";
    } else {
      this.refs.repairValue.textContent = "Ready";
      this.refs.repairValue.style.color = "#a8d6ff";
    }
  }

  updateInventory(inventoryState = {}) {
    const items = Array.isArray(inventoryState.items) ? inventoryState.items : [];
    const slot1 = items[0] || null;
    const slot2 = items[1] || null;

    const setSlot = (node, entry, index) => {
      if (!entry) {
        node.textContent = `Slot ${index}: Empty`;
        node.classList.add("empty");
        return;
      }

      const label = entry.label || getItemLabel(entry.type) || "Item";
      node.textContent = `Slot ${index}: ${label}`;
      node.classList.remove("empty");
    };

    setSlot(this.refs.slot1, slot1, 1);
    setSlot(this.refs.slot2, slot2, 2);
  }

  updateTurbo(stockState = {}) {
    const charges = Math.max(0, toNumber(stockState.turboCharges, 0));
    const maxCharges = Math.max(1, toNumber(stockState.turboMaxCharges, 3));
    const dots = Array.from(this.refs.turboDots.querySelectorAll(".ghuk-turbo-dot"));
    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index < charges);
      dot.style.display = index < maxCharges ? "inline-block" : "none";
    });
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
    this.lastTurboActive = false;
    this.lastHeatCooling = false;
    this.lastWeatherType = WEATHER_EVENT_TYPES.NONE;
    this.lastCountdownLabel = "";
    this.lastFinishCallSecond = -1;
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
    this.refs.dashModeBtn.removeEventListener("click", this.dashboardModeButtonHandler);
    this.dashboardModeButtonHandler = null;

    this.root.remove();
    this.root = null;
    this.refs = null;
    this.minimapContext = null;
  }
}
const DASHBOARD_MODE_STORAGE_KEY = "deliver_hud_dashboard_mode";
const LEGACY_DASHBOARD_MODE_STORAGE_KEY = "repartidor_hud_dashboard_mode";
