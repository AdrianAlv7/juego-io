const WEATHER_PREVIEW = Object.freeze({
  clear: {
    overlay: "none",
    tone: "clear",
    chip: "CLEAR",
    label: "Clear Skies",
    banner: "Weather Cleared",
    bannerTone: "info",
    showHeat: false,
  },
  rain: {
    overlay: "rain",
    tone: "rain",
    chip: "RAIN",
    label: "Heavy Rain",
    banner: "Heavy Rain",
    bannerTone: "info",
    showHeat: false,
  },
  sunny: {
    overlay: "sunny",
    tone: "sunny",
    chip: "SUN",
    label: "Sunny Weather",
    banner: "Sunny Weather",
    bannerTone: "warning",
    showHeat: true,
    heatPercent: 78,
    heatColor: "#ffd56b",
  },
  night: {
    overlay: "night",
    tone: "night",
    chip: "NIGHT",
    label: "Night Event",
    banner: "Night Event",
    bannerTone: "danger",
    showHeat: false,
  },
});

function setupHudWeatherPreview() {
  const root = document.querySelector("#hud-preview .ghuk-root");
  if (!root) return;

  const refs = {
    overlay: root.querySelector(".ghuk-overlay"),
    banner: root.querySelector(".ghuk-banner"),
    weatherEvent: root.querySelector(".ghuk-weather-event"),
    weatherIndicator: root.querySelector(".ghuk-weather-indicator"),
    heatCard: root.querySelector(".ghuk-heat"),
    heatFill: root.querySelector(".ghuk-heat-fill"),
    heatValue: root.querySelector(".ghuk-heat-value"),
        rainGlass: root.querySelector(".ghuk-rain-glass"),
sunFlare: root.querySelector(".ghuk-sun-flare"),
nightGlow: root.querySelector(".ghuk-night-glow"),
    buttons: Array.from(root.querySelectorAll(".ghuk-btn[data-tone]")),

  };

  let weatherTimerId = 0;
  let bannerTimerId = 0;

  const clearWeatherTimer = () => {
    if (!weatherTimerId) return;
    window.clearInterval(weatherTimerId);
    weatherTimerId = 0;
  };

  const clearBannerTimer = () => {
    if (!bannerTimerId) return;
    window.clearTimeout(bannerTimerId);
    bannerTimerId = 0;
  };

  const setBanner = (message, tone = "info", durationMs = 1400) => {
    if (!refs.banner) return;
    clearBannerTimer();
    refs.banner.textContent = message;
    refs.banner.dataset.tone = tone;
    refs.banner.classList.remove("ghuk-hidden");
    bannerTimerId = window.setTimeout(() => {
      refs.banner.classList.add("ghuk-hidden");
    }, durationMs);
  };

  const setButtonsState = (activeAction) => {
    refs.buttons.forEach((button) => {
      const action = String(button.dataset.tone || "").toLowerCase();
      button.classList.toggle("is-active", action === activeAction);
    });
  };

  const setHeatPreview = (config) => {
    if (!refs.heatCard || !refs.heatFill || !refs.heatValue) return;
    refs.heatCard.classList.toggle("ghuk-hidden", !config.showHeat);
    if (!config.showHeat) return;
    const percent = Math.max(2, Math.min(100, Number(config.heatPercent || 70)));
    refs.heatFill.style.height = `${percent}%`;
    refs.heatValue.textContent = `${Math.round(percent)}%`;
    refs.heatValue.style.color = config.heatColor || "#ebf6ff";
  };

  const renderWeatherEvent = (config, remainingMs) => {
    if (!refs.weatherEvent) return;
    refs.weatherEvent.dataset.tone = config.tone;
    if (config.overlay === "none") {
      refs.weatherEvent.classList.add("ghuk-hidden");
      return;
    }
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    refs.weatherEvent.textContent = `${config.label} active ${remainingSeconds}s`;
    refs.weatherEvent.classList.remove("ghuk-hidden");
  };

  const activateWeather = (action, options = {}) => {
    const config = WEATHER_PREVIEW[action] || WEATHER_PREVIEW.clear;
    clearWeatherTimer();

    if (refs.overlay) {
      refs.overlay.dataset.weather = config.overlay;
    }
    if (refs.weatherIndicator) {
      refs.weatherIndicator.textContent = config.chip;
      refs.weatherIndicator.dataset.tone = config.tone;
    }

    setButtonsState(action);
    setHeatPreview(config);

    if (!options.silentBanner) {
      setBanner(config.banner, config.bannerTone);
    }

    if (config.overlay === "none") {
      renderWeatherEvent(config, 0);
      return;
    }

    const durationMs = Math.max(4000, Number(options.durationMs || 16000));
    const endsAtMs = Date.now() + durationMs;

    const tick = () => {
      const remainingMs = endsAtMs - Date.now();
      if (remainingMs <= 0) {
        activateWeather("clear", { silentBanner: false });
        return;
      }
      renderWeatherEvent(config, remainingMs);
    };

    tick();
    weatherTimerId = window.setInterval(tick, 250);
  };

  refs.buttons.forEach((button) => {
    const action = String(button.dataset.tone || "").toLowerCase();
    if (!WEATHER_PREVIEW[action]) {
      button.disabled = true;
      button.classList.add("ghuk-btn--disabled");
      button.title = "Evento no habilitado en este preview";
      return;
    }
    button.addEventListener("click", () => activateWeather(action));
  });

  if (refs.banner) {
    refs.banner.classList.add("ghuk-hidden");
  }

  const initialAction = (() => {
    const overlayState = String(refs.overlay?.dataset.weather || "").toLowerCase();
    if (overlayState && overlayState !== "none" && WEATHER_PREVIEW[overlayState]) {
      return overlayState;
    }
    return "night";
  })();

  activateWeather(initialAction, { silentBanner: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupHudWeatherPreview, {
    once: true,
  });
} else {
  setupHudWeatherPreview();
}
