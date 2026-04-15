// Capa de interfaz del GameScene.
// Construye y actualiza UI de lobby, clima, inventario, stock positivo, debug de resultados y entrada de nombre.
import {
  GARAGE_MOTOS,
  getGarageMotoById,
  getSelectedGarageMotoConfig,
  saveSelectedGarageMotoId,
} from "../../garage/catalog.js";
import NightVisionOverlay from "../../events/weather/NightVisionOverlay.js";
import ItemInventoryPanel from "../../items/ItemInventoryPanel.js";
import PositiveStockPanel from "../../items/PositiveStockPanel.js";
import { ITEM_TYPES } from "../../items/catalog.js";
import {
  WEATHER_EVENT_CONFIG,
  WEATHER_EVENT_TYPES,
} from "../../events/weather/catalog.js";
import appAudioManager from "../../ui/AppAudioManager.js";
import LobbyMotoAmbientController from "../../ui/LobbyMotoAmbientController.js";
import {
  CONTROL_PRESET_IDS,
  getControlGuideRows,
  getControlPreset,
  loadControlPresetId,
  saveControlPresetId,
} from "../../systems/controlPresets.js";
import {
  getAvailableLanguages,
  getLanguage,
  getLanguageLabel,
  setLanguage,
  t,
} from "../../i18n/index.js";
import { ACTIVE_MAP } from "../../world/activeMap.js";
import { USERNAME_MAX_LENGTH, WEATHER_UI_MARGIN } from "./constants.js";

const RAIN_PARTICLE_TEXTURE_KEY = "weather-raindrop";
const PLAYER_NAME_STORAGE_KEY = "deliver_player_name";
const LEGACY_PLAYER_NAME_STORAGE_KEY = "repartidor_player_name";
const DEFAULT_LOBBY_TRACK_PREVIEW_LABELS = [
  "intro",
  "drop1-1",
  "drop1-2",
  "drop1-3",
  "drop1-4",
  "drop1-5 moto",
  "drop1-6 moto",
  "drop1-end",
  "antes dropinsano",
  "dropinsano1-1",
  "dropinsano1-2",
  "dropinsano1-end",
  "end",
  "intermedio",
];
const SETTINGS_SECTION_IDS = Object.freeze({
  VOLUME: "volume",
  CONTROLS: "controls",
  LANGUAGE: "language",
});
const CONTROL_PRESET_TRANSLATION_KEYS = Object.freeze({
  [CONTROL_PRESET_IDS.ARROWS]: "controls.presets.flechitas",
  [CONTROL_PRESET_IDS.WASD]: "controls.presets.wasd",
});
const CONTROL_GUIDE_ACTION_KEYS = Object.freeze([
  "accelerate",
  "reverse",
  "left",
  "right",
  "drift",
  "brake",
  "item",
  "nitro",
]);

function getLocalizedControlPresetLabel(presetId) {
  const preset = getControlPreset(presetId);
  const key = CONTROL_PRESET_TRANSLATION_KEYS[preset.id] || "";
  return key ? t(key, {}, preset.label) : preset.label;
}

function getLocalizedControlGuideRows(presetId) {
  return getControlGuideRows(presetId).map((entry, index) => ({
    ...entry,
    action: t(
      `controls.guide.actions.${CONTROL_GUIDE_ACTION_KEYS[index]}`,
      {},
      entry.action
    ),
  }));
}

function bindDomInputNode(scene, node, options = {}) {
  if (!node) return;

  const { onEnter = null } = options;
  const syncCapture = () => scene.syncKeyboardCaptureState?.();

  node.addEventListener("focus", syncCapture);
  node.addEventListener("click", syncCapture);
  node.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter" && onEnter) {
      event.preventDefault();
      onEnter();
    }
  });
  node.addEventListener("keyup", (event) => {
    event.stopPropagation();
  });
  node.addEventListener("blur", () => {
    window.setTimeout(syncCapture, 0);
  });
}

function normalizeTextValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "")).join("\n");
  }
  return String(value ?? "");
}

function clampVolumeSetting(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function formatVolumePercent(value) {
  return `${Math.round(clampVolumeSetting(value) * 100)}%`;
}

function isTextEntryElement(node) {
  if (!(node instanceof HTMLElement)) return false;

  if (node instanceof HTMLTextAreaElement) {
    return !node.disabled && !node.readOnly;
  }

  if (node instanceof HTMLInputElement) {
    if (node.disabled || node.readOnly) return false;
    const inputType = String(node.type || "text").toLowerCase();
    const nonTextTypes = new Set([
      "button",
      "checkbox",
      "color",
      "date",
      "datetime-local",
      "file",
      "hidden",
      "image",
      "month",
      "number",
      "radio",
      "range",
      "reset",
      "submit",
      "time",
      "week",
    ]);
    return !nonTextTypes.has(inputType);
  }

  if (node instanceof HTMLSelectElement) {
    return !node.disabled;
  }

  return node.isContentEditable;
}

function setLobbyButtonLabel(buttonNode, value) {
  if (!buttonNode) return;
  const normalized = normalizeTextValue(value);
  let labelNode = buttonNode.querySelector(".lhl-btn-label");
  if (!labelNode) {
    labelNode = document.createElement("span");
    labelNode.className = "lhl-btn-label";
    buttonNode.textContent = "";
    buttonNode.appendChild(labelNode);
  }
  labelNode.textContent = normalized;
}

const AUDIO_TOGGLE_ICONS = {
  music:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 3v12.55A4 4 0 1 1 14 12V7.2l-6 1.4v6.9A4 4 0 1 1 6 12V7l10-4z"/></svg>',
  sfx:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 10.5V13.5H7.25L12 18V6L7.25 10.5H3ZM15.5 9.25A4.25 4.25 0 0 1 15.5 14.75L16.9 16.15A6.2 6.2 0 0 0 16.9 7.85L15.5 9.25ZM18.3 6.45A8.15 8.15 0 0 1 18.3 17.55L19.7 18.95A10.1 10.1 0 0 0 19.7 5.05L18.3 6.45Z"/></svg>',
};

function createAudioToggleButton(config) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `lhl-audio-toggle lhl-audio-toggle--${config.kind || "generic"}`;
  button.innerHTML = `
    <span class="lhl-audio-toggle-icon" aria-hidden="true">${AUDIO_TOGGLE_ICONS[config.kind] || ""}</span>
    <span class="lhl-audio-toggle-meta">
      <span class="lhl-audio-toggle-label">${config.label || "AUDIO"}</span>
      <span class="lhl-audio-toggle-state">ON</span>
    </span>
  `;
  return button;
}

function createDomTextProxy(node, options = {}) {
  const { setContent = null } = options;
  const targetNode = node || null;
  const proxy = {
    setText(value) {
      if (!targetNode) return proxy;
      if (typeof setContent === "function") {
        setContent(value);
      } else if (targetNode.classList?.contains("lhl-btn")) {
        setLobbyButtonLabel(targetNode, value);
      } else {
        targetNode.textContent = normalizeTextValue(value);
      }
      return proxy;
    },
    setColor(value) {
      if (targetNode) {
        targetNode.style.color = String(value || "");
      }
      return proxy;
    },
    setVisible(visible) {
      if (targetNode) {
        targetNode.style.display = visible ? "" : "none";
      }
      return proxy;
    },
    setPosition() {
      return proxy;
    },
    setWordWrapWidth() {
      return proxy;
    },
    setOrigin() {
      return proxy;
    },
    setScrollFactor() {
      return proxy;
    },
    setDepth() {
      return proxy;
    },
  };

  return proxy;
}

function createDomPanelProxy(node, visibleDisplay = "block") {
  const targetNode = node || null;
  const proxy = {
    setVisible(visible) {
      if (targetNode) {
        targetNode.style.display = visible ? visibleDisplay : "none";
      }
      return proxy;
    },
    setPosition() {
      return proxy;
    },
    setSize() {
      return proxy;
    },
    setScrollFactor() {
      return proxy;
    },
    setDepth() {
      return proxy;
    },
    setStrokeStyle() {
      return proxy;
    },
  };

  return proxy;
}

function createDomButtonProxy(buttonNode) {
  const targetNode = buttonNode || null;
  let clickHandler = null;
  let interactive = false;
  const proxy = {
    setVisible(visible) {
      if (targetNode) {
        targetNode.style.display = visible ? "inline-flex" : "none";
      }
      return proxy;
    },
    setInteractive() {
      interactive = true;
      if (targetNode) {
        targetNode.disabled = false;
      }
      return proxy;
    },
    disableInteractive() {
      interactive = false;
      if (targetNode) {
        targetNode.disabled = true;
      }
      return proxy;
    },
    on(eventName, handler) {
      if (eventName === "pointerdown") {
        clickHandler = handler;
      }
      return proxy;
    },
    setPosition() {
      return proxy;
    },
    setSize() {
      return proxy;
    },
    setScrollFactor() {
      return proxy;
    },
    setDepth() {
      return proxy;
    },
    setStrokeStyle() {
      return proxy;
    },
  };

  if (targetNode) {
    targetNode.addEventListener("click", () => {
      if (!interactive) return;
      clickHandler?.();
    });
  }

  return proxy;
}

export const gameSceneUiMethods = {
  getNormalizedRoomCode() {
    const rawValue = this.roomCodeInput?.value ?? this.roomCodeValue ?? "";
    const normalizedValue = String(rawValue)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    this.roomCodeValue = normalizedValue;
    if (this.roomCodeInput) {
      this.roomCodeInput.value = normalizedValue;
    }
    return normalizedValue;
  },

  setNameEntryBusy(roomMode = null) {
    const isBusy = Boolean(roomMode);
    const buttonConfigs = [
      {
        button: this.publicMatchButton,
        modes: ["public"],
        busyLabel: t("messages.busyPublic", {}, "Buscando..."),
      },
      {
        button: this.privateModeButton,
        modes: [],
        busyLabel: "",
      },
      {
        button: this.privateCreateButton,
        modes: ["private_create"],
        busyLabel: t("messages.busyCreatePrivate", {}, "Creando..."),
      },
      {
        button: this.privateJoinButton,
        modes: ["private_join"],
        busyLabel: t("messages.busyJoinPrivate", {}, "Uniendo..."),
      },
      {
        button: this.extraActionButton,
        modes: [],
        busyLabel: "",
      },
      {
        button: this.futureActionButton,
        modes: [],
        busyLabel: "",
      },
      {
        button: this.privateBackButton,
        modes: [],
        busyLabel: "",
      },
    ];

    if (this.nameInput) {
      this.nameInput.disabled = isBusy;
    }
    if (this.roomCodeInput) {
      this.roomCodeInput.disabled = isBusy;
    }

    buttonConfigs.forEach(({ button, modes, busyLabel }) => {
      if (!button) return;
      button.disabled = isBusy;
      const nextLabel =
        isBusy && modes.includes(roomMode)
          ? busyLabel
          : button.dataset.defaultLabel || "";
      setLobbyButtonLabel(button, nextLabel);
    });
    this.updatePrivateJoinButtonState();
    this.syncKeyboardCaptureState();
  },

  updatePrivateJoinButtonState() {
    if (!this.privateJoinButton) return;
    const hasCode = Boolean((this.roomCodeInput?.value || "").trim());
    const lockedByBusy = Boolean(this.roomCodeInput?.disabled);
    this.privateJoinButton.disabled = lockedByBusy || !hasCode;
  },

  setNameEntryMode(mode = "main") {
    this.nameEntryMode = mode === "private" ? "private" : "main";
    if (this.mainActionsRoot) {
      this.mainActionsRoot.style.display =
        this.nameEntryMode === "main" ? "grid" : "none";
    }
    if (this.privateActionsRoot) {
      this.privateActionsRoot.style.display =
        this.nameEntryMode === "private" ? "flex" : "none";
    }
    if (this.nameEntryMode === "private") {
      this.updatePrivateJoinButtonState();
    }
    this.syncKeyboardCaptureState();
  },

  setLobbyMessage(message, color = "#ffd27d") {
    this.lobbyMessage?.setText(message || "");
    this.lobbyMessage?.setColor(color);
  },

  async copyCurrentRoomCode() {
    const roomCode = this.currentLobbyState?.roomCode || "";
    if (!roomCode) return;
    if ((this.roomShareCopyCooldownUntilMs || 0) > Date.now()) return;

    try {
      await navigator.clipboard.writeText(roomCode);
      this.roomShareCopyCooldownUntilMs = Date.now() + 1800;
      if (this.roomShareButton) {
        this.roomShareButton.disabled = true;
        setLobbyButtonLabel(this.roomShareButton, t("buttons.copiedText", {}, "Texto copiado"));
      }
      this.setLobbyMessage(
        t("messages.roomCodeCopied", { roomCode }, `Codigo ${roomCode} copiado al portapapeles.`),
        "#95f5c8"
      );
      if (this.roomShareCopyResetTimer) {
        window.clearTimeout(this.roomShareCopyResetTimer);
      }
      this.roomShareCopyResetTimer = window.setTimeout(() => {
        this.roomShareCopyResetTimer = null;
        this.roomShareCopyCooldownUntilMs = 0;
        this.updateRoomShareUi?.();
      }, 1800);
    } catch (_error) {
      this.setLobbyMessage(
        t(
          "messages.roomCodeCopyError",
          { roomCode },
          `No se pudo copiar. Comparte este codigo manualmente: ${roomCode}`
        ),
        "#ffcf88"
      );
      this.roomShareCopyCooldownUntilMs = 0;
      if (this.roomShareButton) {
        this.roomShareButton.disabled = false;
      }
    }
  },

  updateRoomShareUi() {
    if (!this.roomShareRoot) return;

    const roomCode = this.currentLobbyState?.roomCode || "";
    const isPrivateRoom =
      this.currentLobbyState?.roomType === "private" && Boolean(roomCode);
    const isHost = this.currentLobbyState?.hostId === this.multiplayer?.selfId;
    const showGarageButton = Boolean(this.isRegistered && !this.matchRunning);
    const showSettingsButton = Boolean(this.isRegistered && !this.matchRunning);
    const showShareUi = Boolean(isPrivateRoom);

    if (this.garageQuickButton) {
      if (this.lobbyGarageActionMount) {
        if (this.garageQuickButton.parentElement !== this.lobbyGarageActionMount) {
          this.lobbyGarageActionMount.appendChild(this.garageQuickButton);
        }
      }
      this.garageQuickButton.style.display = showGarageButton ? "inline-flex" : "none";
    }

    if (this.settingsQuickButton) {
      if (this.lobbyGarageActionMount) {
        if (this.settingsQuickButton.parentElement !== this.lobbyGarageActionMount) {
          this.lobbyGarageActionMount.appendChild(this.settingsQuickButton);
        }
      }
      this.settingsQuickButton.style.display = showSettingsButton ? "inline-flex" : "none";
    }

    this.roomShareRoot.style.display = showShareUi ? "flex" : "none";
    if (this.lobbyGarageActionMount) {
      this.lobbyGarageActionMount.style.display =
        showGarageButton || showSettingsButton ? "flex" : "none";
    }

    if (!showShareUi) {
      if (this.roomShareCodeValue) this.roomShareCodeValue.style.display = "none";
      if (this.roomShareLabel) this.roomShareLabel.style.display = "none";
      if (this.roomShareHint) this.roomShareHint.style.display = "none";
      if (this.roomShareButton) this.roomShareButton.style.display = "none";
      return;
    }

    if (this.roomShareCodeValue) {
      this.roomShareCodeValue.textContent = roomCode;
      this.roomShareCodeValue.style.display = "";
    }
    if (this.roomShareLabel) {
      this.roomShareLabel.textContent = isHost
        ? t("labels.shareCode", {}, "Comparte este codigo")
        : t("labels.roomCode", {}, "Codigo de sala");
      this.roomShareLabel.style.display = "";
    }
    if (this.roomShareHint) {
      this.roomShareHint.textContent =
        isHost
          ? t(
              "hints.shareAsHost",
              {},
              "Compartelo con tus amigos para que entren directo a tu sala privada."
            )
          : t(
              "hints.shareAsGuest",
              {},
              "Guardalo o copialo si quieres invitar a alguien mas despues."
            );
      this.roomShareHint.style.display = "";
    }
    if (this.roomShareButton) {
      const cooldownActive = (this.roomShareCopyCooldownUntilMs || 0) > Date.now();
      setLobbyButtonLabel(
        this.roomShareButton,
        cooldownActive
          ? t("buttons.copiedText", {}, "Texto copiado")
          : t("buttons.copyCode", {}, "Copiar codigo")
      );
      this.roomShareButton.disabled = cooldownActive;
      this.roomShareButton.style.display = "inline-flex";
    }
  },

  isDomTextEntryActive() {
    if (typeof document === "undefined") return false;
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return false;
    return isTextEntryElement(activeElement);
  },

  syncKeyboardCaptureState() {
    const keyboard = this.input?.keyboard;
    if (!keyboard) return;

    const shouldCaptureInput =
      this.matchRunning && !this.matchEnded && !this.isDomTextEntryActive();
    keyboard.enabled = shouldCaptureInput;

    if (shouldCaptureInput) {
      keyboard.enableGlobalCapture?.();
    } else {
      keyboard.disableGlobalCapture?.();
    }
  },

  createNameEntryUi() {
    const appRoot = document.getElementById("app");
    if (!appRoot) return;

    appRoot.style.position = "relative";

    this.nameEntryRoot = document.createElement("div");
    this.nameEntryRoot.className = "lhl-entry";

    const helperCaption = document.createElement("div");
    helperCaption.className = "lhl-entry-caption";
    helperCaption.textContent = t("labels.lobby", {}, "Lobby");

    const usernameRow = document.createElement("div");
    usernameRow.className = "lhl-inputs-row";

    const nameGroup = document.createElement("div");
    nameGroup.className = "lhl-input-group lhl-input-group--full";
    const nameLabel = document.createElement("label");
    nameLabel.className = "lhl-input-label";
    nameLabel.textContent = t("labels.username", {}, "Username");

    this.nameInput = document.createElement("input");
    this.nameInput.type = "text";
    this.nameInput.maxLength = USERNAME_MAX_LENGTH;
    this.nameInput.placeholder = t("labels.username", {}, "Username");
    this.nameInput.className = "lhl-input lhl-input-player";

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(this.nameInput);
    usernameRow.appendChild(nameGroup);

    const makeActionButton = (label, classes = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.defaultLabel = label;
      button.className = `lhl-btn lhl-btn-entry lhl-btn-tile ${classes}`.trim();
      setLobbyButtonLabel(button, label);
      return button;
    };

    this.mainActionsRoot = document.createElement("div");
    this.mainActionsRoot.className = "lhl-main-grid";
    this.privateActionsRoot = document.createElement("div");
    this.privateActionsRoot.className = "lhl-private-view";

    this.publicMatchButton = makeActionButton(
      t("buttons.public", {}, "Publica"),
      "lhl-btn-public"
    );
    this.privateModeButton = makeActionButton(
      t("buttons.private", {}, "Privada"),
      "lhl-btn-private"
    );
    this.extraActionButton = makeActionButton(
      t("buttons.settings", {}, "Ajustes"),
      "lhl-btn-settings"
    );
    this.futureActionButton = makeActionButton(
      t("buttons.garage", {}, "Garage"),
      "lhl-btn-garage"
    );

    const roomGroup = document.createElement("div");
    roomGroup.className = "lhl-input-group lhl-input-group--full";
    const roomLabel = document.createElement("label");
    roomLabel.className = "lhl-input-label";
    roomLabel.textContent = t("labels.roomCode", {}, "Codigo de sala");

    this.roomCodeInput = document.createElement("input");
    this.roomCodeInput.type = "text";
    this.roomCodeInput.maxLength = 8;
    this.roomCodeInput.placeholder = t("labels.code", {}, "Codigo");
    this.roomCodeInput.className = "lhl-input lhl-input-room";
    roomGroup.appendChild(roomLabel);
    roomGroup.appendChild(this.roomCodeInput);

    this.privateCreateButton = makeActionButton(
      t("buttons.createRoom", {}, "Crear sala"),
      "lhl-btn-private"
    );
    this.privateJoinButton = makeActionButton(
      t("buttons.joinRoom", {}, "Unirse a sala"),
      "lhl-btn-warn"
    );
    this.privateBackButton = makeActionButton(
      t("buttons.back", {}, "Regresar"),
      "lhl-btn-minimal"
    );

    const submitPublic = () => this.submitNameEntry("public");
    const submitCreatePrivate = () => this.submitNameEntry("private_create");
    const submitJoinPrivate = () => this.submitNameEntry("private_join");

    this.publicMatchButton.addEventListener("click", submitPublic);
    this.privateModeButton.addEventListener("click", () => {
      this.setNameEntryMode("private");
      this.setLobbyMessage(
        t("messages.privateMode", {}, "Modo privada: crea sala o unete con codigo."),
        "#8ad6ff"
      );
      this.roomCodeInput?.focus();
    });
    this.privateBackButton.addEventListener("click", () => {
      this.setNameEntryMode("main");
      this.setLobbyMessage(
        t("messages.entryDefault", {}, "Escribe username y elige publica o privada.")
      );
      this.nameInput?.focus();
    });
    this.privateCreateButton.addEventListener("click", submitCreatePrivate);
    this.privateJoinButton.addEventListener("click", submitJoinPrivate);
    this.extraActionButton.addEventListener("click", () => {
      this.openSettingsModal({ mode: "entry" });
    });
    this.futureActionButton.addEventListener("click", () => {
      this.openGarageModal({ mode: "entry" });
    });

    bindDomInputNode(this, this.nameInput, { onEnter: submitPublic });
    bindDomInputNode(this, this.roomCodeInput, { onEnter: submitJoinPrivate });
    bindDomInputNode(this, this.publicMatchButton);
    bindDomInputNode(this, this.privateModeButton);
    bindDomInputNode(this, this.privateCreateButton);
    bindDomInputNode(this, this.privateJoinButton);
    bindDomInputNode(this, this.privateBackButton);
    bindDomInputNode(this, this.extraActionButton);
    bindDomInputNode(this, this.futureActionButton);

    this.roomCodeInput.addEventListener("input", () => {
      this.getNormalizedRoomCode();
      this.updatePrivateJoinButtonState();
    });

    this.mainActionsRoot.appendChild(this.publicMatchButton);
    this.mainActionsRoot.appendChild(this.privateModeButton);
    this.mainActionsRoot.appendChild(this.extraActionButton);
    this.mainActionsRoot.appendChild(this.futureActionButton);

    this.privateActionsRoot.appendChild(this.privateCreateButton);
    this.privateActionsRoot.appendChild(roomGroup);
    this.privateActionsRoot.appendChild(this.privateJoinButton);
    this.privateActionsRoot.appendChild(this.privateBackButton);

    this.nameEntryRoot.appendChild(helperCaption);
    this.nameEntryRoot.appendChild(usernameRow);
    this.nameEntryRoot.appendChild(this.mainActionsRoot);
    this.nameEntryRoot.appendChild(this.privateActionsRoot);

    const mountPoint = this.lobbyEntryMount || appRoot;
    mountPoint.appendChild(this.nameEntryRoot);
    this.setNameEntryMode("main");
    this.updatePrivateJoinButtonState();
    this.nameInput.focus();
    this.syncKeyboardCaptureState();
  },

  submitNameEntry(roomMode = "public") {
    if (!this.multiplayer || this.isRegistered) return;
    const raw = this.nameInput?.value?.trim() || "";
    const safeName = (raw || "Jugador").slice(0, USERNAME_MAX_LENGTH);
    const roomCode = this.getNormalizedRoomCode();
    const resolvedRoomCode = roomMode === "private_create" ? "" : roomCode;
    if (roomMode === "private_join" && !resolvedRoomCode) {
      this.lobbyMessage.setText(
        t(
          "messages.privateJoinNeedsCode",
          {},
          "Escribe un codigo para entrar a una sala privada."
        )
      );
      this.lobbyMessage.setColor("#ffcf88");
      this.roomCodeInput?.focus();
      return;
    }

    this.pendingRoomMode = roomMode;
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, safeName);

    this.blurNameEntry();
    this.nameInput.value = safeName;
    this.setNameEntryBusy(roomMode);
    this.setLobbyMessage(
      roomMode === "public"
        ? t("messages.busyPublicSearch", {}, "Buscando sala publica...")
        : roomMode === "private_create"
          ? t("messages.busyPrivateCreate", {}, "Creando sala privada...")
          : t("messages.busyPrivateJoin", {}, "Uniendote a sala privada...")
    );

    this.multiplayer.start({
      name: safeName,
      roomMode,
      roomCode: resolvedRoomCode,
      motoId: this.garageSelectionWasManual ? this.selectedGarageMotoId : null,
      preferredSpawn: ACTIVE_MAP.getSpawnPoint(),
    });
  },

  onSocketInit() {
    this.isRegistered = true;
    this.closeGarageModal({ apply: false, silent: true });
    this.blurNameEntry();
    if (this.nameEntryRoot) {
      this.nameEntryRoot.style.display = "none";
    }
    this.setNameEntryBusy(null);
    this.setLeaveRoomUiVisible(true);
    this.syncKeyboardCaptureState();
    this.renderLobbyState();
    this.updateRoomShareUi();
  },

  blurNameEntry() {
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur?.();
    }
    this.nameInput?.blur?.();
    this.roomCodeInput?.blur?.();
    this.publicMatchButton?.blur?.();
    this.privateModeButton?.blur?.();
    this.privateCreateButton?.blur?.();
    this.privateJoinButton?.blur?.();
    this.privateBackButton?.blur?.();
    this.extraActionButton?.blur?.();
    this.futureActionButton?.blur?.();
    this.garageQuickButton?.blur?.();
    this.settingsQuickButton?.blur?.();
    this.garageCloseButton?.blur?.();
    this.garageApplyButton?.blur?.();
    this.settingsCloseButton?.blur?.();
    this.settingsPreviewMusicButton?.blur?.();
    this.settingsTrackPreviewButtons?.forEach((button) => button?.blur?.());
    this.settingsSfxSlider?.blur?.();
    this.settingsMusicSlider?.blur?.();
    this.musicMuteToggleButton?.blur?.();
    this.sfxMuteToggleButton?.blur?.();
    this.garageOptionButtons?.forEach((button) => button?.blur?.());
    this.syncKeyboardCaptureState();
  },

  setGarageQuickUiVisible(visible) {
    if (!this.garageQuickButton) return;
    const showButton = Boolean(visible && this.isRegistered && !this.matchRunning);
    this.garageQuickButton.style.display = showButton ? "inline-flex" : "none";
    this.updateRoomShareUi();
    this.syncKeyboardCaptureState();
  },

  refreshGarageRosterUi() {
    if (!this.garageRosterList) return;

    const players = Array.isArray(this.currentLobbyState?.players)
      ? this.currentLobbyState.players
      : [];
    const selfId = this.multiplayer?.selfId || "";
    const rosterPlayers = players.length
      ? players.map((player) => ({
          ...player,
          motoId:
            player.id === selfId
              ? this.garageWorkingMotoId || player.motoId || this.selectedGarageMotoId
              : player.motoId,
        }))
      : [
          {
            id: "local-preview",
            name: "Tu moto",
            ready: false,
            motoId: this.garageWorkingMotoId || this.selectedGarageMotoId,
          },
        ];
    this.garageRosterList.innerHTML = "";
    rosterPlayers.forEach((player) => {
      const moto = getGarageMotoById(player?.motoId);
      const item = document.createElement("article");
      item.className = "lhl-garage-roster-item";
      if (player?.id === selfId) {
        item.classList.add("is-self");
      }

      const image = document.createElement("img");
      image.className = "lhl-garage-roster-image";
      image.src = moto.previewSrc;
      image.alt = moto.label;

      const meta = document.createElement("div");
      meta.className = "lhl-garage-roster-meta";

      const name = document.createElement("div");
      name.className = "lhl-garage-roster-name";
      name.textContent = player?.id === selfId ? "Tu moto" : player?.name || "Jugador";

      const label = document.createElement("div");
      label.className = "lhl-garage-roster-label";
      label.textContent = moto.label;

      meta.appendChild(name);
      meta.appendChild(label);
      item.appendChild(image);
      item.appendChild(meta);
      this.garageRosterList.appendChild(item);
    });
  },

  refreshLobbyGaragePreview() {
    if (!this.lobbyGarageSpotlightNode) return;

    const showPanel = Boolean(this.isRegistered && !this.matchRunning);
    this.lobbyGarageSpotlightNode.style.display = showPanel ? "flex" : "none";
    if (!showPanel) {
      this.lobbyGarageSpotlightNode.innerHTML = "";
      return;
    }

    const players = Array.isArray(this.currentLobbyState?.players)
      ? this.currentLobbyState.players
      : [];
    const selfId = this.multiplayer?.selfId || "";
    const previewPlayers = players.length
      ? players
      : [
          {
            id: selfId || "local-preview",
            name: "Jugador",
            ready: false,
            motoId: this.selectedGarageMotoId,
          },
        ];

    this.lobbyGarageSpotlightNode.innerHTML = "";

    const list = document.createElement("div");
    list.className = "lhl-garage-side-list";

    previewPlayers.forEach((player) => {
      const isSelf = player?.id === selfId;
      const moto = getGarageMotoById(
        isSelf ? this.selectedGarageMotoId || player?.motoId : player?.motoId
      );
      const item = document.createElement("div");
      item.className = "lhl-garage-side-item";
      if (isSelf) {
        item.classList.add("is-self");
      }

      const visual = document.createElement("div");
      visual.className = "lhl-garage-side-item-visual";

      const image = document.createElement("img");
      image.className = "lhl-garage-side-item-image";
      image.src = moto.previewSrc;
      image.alt = moto.label;
      visual.appendChild(image);

      const meta = document.createElement("div");
      meta.className = "lhl-garage-side-item-meta";

      const name = document.createElement("div");
      name.className = "lhl-garage-side-item-name";
      name.textContent = isSelf ? "Tu moto" : player?.name || "Jugador";

      const label = document.createElement("div");
      label.className = "lhl-garage-side-item-label";
      label.textContent = moto.label;

      meta.appendChild(name);
      meta.appendChild(label);
      item.appendChild(visual);
      item.appendChild(meta);
      list.appendChild(item);
    });

    this.lobbyGarageSpotlightNode.appendChild(list);
    this.syncLobbyGaragePreviewAlignment?.();
  },

  syncLobbyGaragePreviewAlignment() {
    const playersPanelNode = this.lobbyPlayersPanelNode;
    const spotlightNode = this.lobbyGarageSpotlightNode;
    const listNode = spotlightNode?.querySelector(".lhl-garage-side-list");

    if (!playersPanelNode || !spotlightNode || !listNode) return;

    const playerRows = Array.from(
      playersPanelNode.querySelectorAll(".lhl-player-row:not(.lhl-player-row--muted)")
    );
    const previewItems = Array.from(
      listNode.querySelectorAll(".lhl-garage-side-item")
    );

    if (!playerRows.length || playerRows.length !== previewItems.length) {
      listNode.style.position = "";
      listNode.style.display = "";
      listNode.style.height = "";
      previewItems.forEach((item) => {
        item.style.position = "";
        item.style.left = "";
        item.style.right = "";
        item.style.top = "";
        item.style.height = "";
        item.style.minHeight = "";
      });
      return;
    }

    const panelRect = playersPanelNode.getBoundingClientRect();
    listNode.style.position = "relative";
    listNode.style.display = "block";
    listNode.style.height = `${playersPanelNode.offsetHeight}px`;

    previewItems.forEach((item, index) => {
      const row = playerRows[index];
      const rowRect = row.getBoundingClientRect();
      const rowHeight = rowRect.height;
      const rowTop = rowRect.top - panelRect.top;
      item.style.position = "absolute";
      item.style.left = "0";
      item.style.right = "0";
      item.style.top = `${rowTop}px`;
      item.style.height = `${rowHeight}px`;
      item.style.minHeight = `${rowHeight}px`;
    });
  },

  syncGarageSelectionUi() {
    if (!this.garageRoot) return;
    const selectedMoto = getGarageMotoById(this.garageWorkingMotoId || this.selectedGarageMotoId);
    this.garageWorkingMotoId = selectedMoto.id;

    if (this.garagePreviewImage) {
      this.garagePreviewImage.src = selectedMoto.previewSrc;
      this.garagePreviewImage.alt = selectedMoto.label;
    }
    if (this.garagePreviewName) {
      this.garagePreviewName.textContent = selectedMoto.label;
    }

    this.garageOptionButtons?.forEach((button) => {
      const isSelected = button?.dataset?.motoId === selectedMoto.id;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    this.refreshGarageRosterUi();
  },

  syncAudioToggleUi() {
    const syncButton = (buttonNode, config) => {
      if (!buttonNode) return;

      const isMuted = Boolean(config.isMuted);
      const stateNode = buttonNode.querySelector(".lhl-audio-toggle-state");
      buttonNode.classList.toggle("is-muted", isMuted);
      buttonNode.setAttribute("aria-pressed", isMuted ? "true" : "false");
      buttonNode.setAttribute("aria-label", isMuted ? config.unmuteLabel : config.muteLabel);
      buttonNode.title = isMuted ? config.unmuteLabel : config.muteLabel;

      if (stateNode) {
        stateNode.textContent = isMuted ? "OFF" : "ON";
      }
    };

    syncButton(this.musicMuteToggleButton, {
      isMuted: appAudioManager.getMusicMuted(),
      muteLabel: t("settings.muteMusic", {}, "Silenciar musica del lobby"),
      unmuteLabel: t("settings.unmuteMusic", {}, "Activar musica del lobby"),
    });
    syncButton(this.sfxMuteToggleButton, {
      isMuted: appAudioManager.getSfxMuted(),
      muteLabel: t("settings.muteSfx", {}, "Silenciar efectos"),
      unmuteLabel: t("settings.unmuteSfx", {}, "Activar efectos"),
    });
  },

  getActiveControlPresetId() {
    const runtimePreset =
      this.inputSystem?.getControlPresetId?.() || this.controlPresetId || "flechitas";
    return getControlPreset(runtimePreset).id;
  },

  renderSettingsControlGuide() {
    if (!this.settingsControlGuideGrid) return;

    const preset = getControlPreset(this.getActiveControlPresetId());
    const guideRows = getLocalizedControlGuideRows(preset.id);
    this.settingsControlGuideGrid.innerHTML = "";

    guideRows.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "lhl-settings-guide-row";

      const keyNode = document.createElement("div");
      keyNode.className = "lhl-settings-guide-key";
      keyNode.textContent = entry.key;

      const actionNode = document.createElement("div");
      actionNode.className = "lhl-settings-guide-action";
      actionNode.textContent = entry.action;

      row.appendChild(keyNode);
      row.appendChild(actionNode);
      this.settingsControlGuideGrid.appendChild(row);
    });

    if (this.settingsControlGuideTitle) {
      this.settingsControlGuideTitle.textContent = t(
        "settings.controlsGuideTitle",
        {
          preset: getLocalizedControlPresetLabel(preset.id),
        },
        `Guia activa: ${preset.label}`
      );
    }
  },

  applyControlPreset(presetId, options = {}) {
    const { silent = false } = options;
    const preset = getControlPreset(saveControlPresetId(presetId));

    this.controlPresetId = preset.id;
    this.inputSystem?.setControlPreset?.(preset.id);
    this.syncSettingsUi();

    if (!silent) {
      this.setLobbyMessage(
        t(
          "messages.controlPresetApplied",
          { preset: getLocalizedControlPresetLabel(preset.id) },
          `Preset de controles aplicado: ${preset.label}.`
        ),
        "#8ad6ff"
      );
    }
  },

  applyLanguageSelection(languageCode, options = {}) {
    const { silent = false } = options;
    const nextLanguage = setLanguage(languageCode);
    const languageLabel = getLanguageLabel(nextLanguage, nextLanguage.toUpperCase());
    this.refreshLocalizedUiText?.();
    this.syncSettingsUi?.();

    if (!silent) {
      this.setLobbyMessage(
        t("messages.languageApplied", { languageLabel }),
        "#8ad6ff"
      );
    }
  },

  refreshLocalizedUiText() {
    if (this.nameEntryRoot) {
      const captionNode = this.nameEntryRoot.querySelector(".lhl-entry-caption");
      if (captionNode) {
        captionNode.textContent = t("labels.lobby", {}, "Lobby");
      }

      const nameLabelNode = this.nameInput
        ?.closest(".lhl-input-group")
        ?.querySelector(".lhl-input-label");
      if (nameLabelNode) {
        nameLabelNode.textContent = t("labels.username", {}, "Username");
      }
      if (this.nameInput) {
        this.nameInput.placeholder = t("labels.username", {}, "Username");
      }

      const roomLabelNode = this.roomCodeInput
        ?.closest(".lhl-input-group")
        ?.querySelector(".lhl-input-label");
      if (roomLabelNode) {
        roomLabelNode.textContent = t("labels.roomCode", {}, "Codigo de sala");
      }
      if (this.roomCodeInput) {
        this.roomCodeInput.placeholder = t("labels.code", {}, "Codigo");
      }

      if (this.publicMatchButton) {
        this.publicMatchButton.dataset.defaultLabel = t("buttons.public", {}, "Publica");
      }
      if (this.privateModeButton) {
        this.privateModeButton.dataset.defaultLabel = t("buttons.private", {}, "Privada");
      }
      if (this.privateCreateButton) {
        this.privateCreateButton.dataset.defaultLabel = t(
          "buttons.createRoom",
          {},
          "Crear sala"
        );
      }
      if (this.privateJoinButton) {
        this.privateJoinButton.dataset.defaultLabel = t(
          "buttons.joinRoom",
          {},
          "Unirse a sala"
        );
      }
      if (this.privateBackButton) {
        this.privateBackButton.dataset.defaultLabel = t("buttons.back", {}, "Regresar");
      }
      if (this.extraActionButton) {
        this.extraActionButton.dataset.defaultLabel = t(
          "buttons.settings",
          {},
          "Ajustes"
        );
      }
      if (this.futureActionButton) {
        this.futureActionButton.dataset.defaultLabel = t("buttons.garage", {}, "Garage");
      }

      const busyState = Boolean(this.nameInput?.disabled || this.roomCodeInput?.disabled);
      this.setNameEntryBusy?.(busyState ? this.pendingRoomMode : null);
    }

    if (this.leaveRoomButton) {
      setLobbyButtonLabel(this.leaveRoomButton, t("buttons.exit", {}, "Salir"));
    }
    if (this.settingsQuickButton) {
      setLobbyButtonLabel(this.settingsQuickButton, t("buttons.settings", {}, "Ajustes"));
    }
    if (this.garageQuickButton) {
      setLobbyButtonLabel(this.garageQuickButton, t("buttons.garage", {}, "Garage"));
    }

    if (this.settingsRoot) {
      this.applySettingsTranslations?.();
    }

    this.updateRoomShareUi?.();
    this.renderLobbyState?.();
  },

  setSettingsSection(sectionId = SETTINGS_SECTION_IDS.VOLUME) {
    const normalized = Object.values(SETTINGS_SECTION_IDS).includes(sectionId)
      ? sectionId
      : SETTINGS_SECTION_IDS.VOLUME;
    this.settingsActiveSection = normalized;

    if (!this.settingsRoot) return;

    const showVolume = normalized === SETTINGS_SECTION_IDS.VOLUME;
    const showControls = normalized === SETTINGS_SECTION_IDS.CONTROLS;
    const showLanguage = normalized === SETTINGS_SECTION_IDS.LANGUAGE;
    this.settingsVolumePanel?.classList.toggle("is-active", showVolume);
    this.settingsControlsPanel?.classList.toggle("is-active", showControls);
    this.settingsLanguagePanel?.classList.toggle("is-active", showLanguage);
    this.settingsVolumeSectionButton?.classList.toggle("is-active", showVolume);
    this.settingsControlsSectionButton?.classList.toggle("is-active", showControls);
    this.settingsLanguageSectionButton?.classList.toggle("is-active", showLanguage);
    this.settingsVolumeSectionButton?.setAttribute("aria-pressed", showVolume ? "true" : "false");
    this.settingsControlsSectionButton?.setAttribute(
      "aria-pressed",
      showControls ? "true" : "false"
    );
    this.settingsLanguageSectionButton?.setAttribute(
      "aria-pressed",
      showLanguage ? "true" : "false"
    );

    if (this.settingsPreviewMusicButton) {
      this.settingsPreviewMusicButton.style.display = showVolume ? "inline-flex" : "none";
    }
  },

  applySettingsTranslations() {
    if (!this.settingsRoot) return;

    if (this.settingsEyebrowText) {
      this.settingsEyebrowText.textContent = t("buttons.settings", {}, "Ajustes");
    }
    if (this.settingsTitleText) {
      this.settingsTitleText.textContent = t("settings.title", {}, "Audio y controles");
    }
    if (this.settingsSubtitleText) {
      this.settingsSubtitleText.textContent = t(
        "settings.subtitle",
        {},
        "Cambios rapidos para volumen y esquema de teclas. Se guardan al instante."
      );
    }

    setLobbyButtonLabel(
      this.settingsVolumeSectionButton,
      t("settings.sectionVolume", {}, "Volumen")
    );
    setLobbyButtonLabel(
      this.settingsControlsSectionButton,
      t("settings.sectionControls", {}, "Controles")
    );
    setLobbyButtonLabel(
      this.settingsLanguageSectionButton,
      t("settings.sectionLanguage", {}, "Idioma")
    );
    setLobbyButtonLabel(
      this.settingsPreviewMusicButton,
      t("buttons.startMusic", {}, "Iniciar musica")
    );
    setLobbyButtonLabel(this.settingsCloseButton, t("buttons.close", {}, "Cerrar"));

    if (this.settingsTextNodes) {
      if (this.settingsTextNodes.musicTitle) {
        this.settingsTextNodes.musicTitle.textContent = t(
          "settings.musicTitle",
          {},
          "Musica del lobby"
        );
      }
      if (this.settingsTextNodes.musicDescription) {
        this.settingsTextNodes.musicDescription.textContent = t(
          "settings.musicDescription",
          {},
          "Intro fija al entrar y transiciones suaves entre variaciones del track del lobby."
        );
      }
      if (this.settingsTextNodes.musicLabel) {
        this.settingsTextNodes.musicLabel.textContent = t(
          "settings.musicVolumeLabel",
          {},
          "Volumen music"
        );
      }
      if (this.settingsTextNodes.sfxTitle) {
        this.settingsTextNodes.sfxTitle.textContent = t(
          "settings.sfxTitle",
          {},
          "Efectos de interfaz"
        );
      }
      if (this.settingsTextNodes.sfxDescription) {
        this.settingsTextNodes.sfxDescription.textContent = t(
          "settings.sfxDescription",
          {},
          "Hover, click y teclado. El control afecta los sonidos cortos del UI en todo el lobby."
        );
      }
      if (this.settingsTextNodes.sfxLabel) {
        this.settingsTextNodes.sfxLabel.textContent = t(
          "settings.sfxVolumeLabel",
          {},
          "Volumen SFX"
        );
      }
      if (this.settingsTextNodes.previewTitle) {
        this.settingsTextNodes.previewTitle.textContent = t(
          "settings.previewTitle",
          {},
          "Pruebas de pista"
        );
      }
      if (this.settingsTextNodes.previewDescription) {
        this.settingsTextNodes.previewDescription.textContent = t(
          "settings.previewDescription",
          {},
          "Lanza una pista especifica para revisar audio y las motos decorativas sin esperar la rotacion."
        );
      }
      if (this.settingsTextNodes.autoplayTip) {
        this.settingsTextNodes.autoplayTip.textContent = t(
          "settings.tipAutoplay",
          {},
          "Tip: si el navegador bloquea autoplay, la musica arrancara al primer click o tecla."
        );
      }
      if (this.settingsTextNodes.controlsTitle) {
        this.settingsTextNodes.controlsTitle.textContent = t(
          "settings.controlsTitle",
          {},
          "Preset de controles"
        );
      }
      if (this.settingsTextNodes.controlsDescription) {
        this.settingsTextNodes.controlsDescription.textContent = t(
          "settings.controlsDescription",
          {},
          "Elige el esquema para jugar. Se usa dentro de partida al instante."
        );
      }
      if (this.settingsTextNodes.languageTitle) {
        this.settingsTextNodes.languageTitle.textContent = t(
          "settings.languageTitle",
          {},
          "Idioma"
        );
      }
      if (this.settingsTextNodes.languageDescription) {
        this.settingsTextNodes.languageDescription.textContent = t(
          "settings.languageDescription",
          {},
          "Selecciona idioma y aplica al momento en botones y mensajes del lobby."
        );
      }
    }

    if (this.settingsControlPresetButtons) {
      this.settingsControlPresetButtons.forEach((buttonNode, presetId) => {
        setLobbyButtonLabel(buttonNode, getLocalizedControlPresetLabel(presetId));
      });
    }

    if (this.settingsLanguageButtons) {
      this.settingsLanguageButtons.forEach((buttonNode, languageCode) => {
        setLobbyButtonLabel(
          buttonNode,
          getLanguageLabel(languageCode, String(languageCode || "").toUpperCase())
        );
      });
    }
  },

  syncSettingsUi() {
    if (!this.settingsRoot) return;
    this.applySettingsTranslations?.();

    const sfxVolume = clampVolumeSetting(appAudioManager.getSfxVolume(), 0.75);
    const musicVolume = clampVolumeSetting(appAudioManager.getMusicVolume(), 0.75);

    if (this.settingsSfxSlider) {
      this.settingsSfxSlider.value = String(Math.round(sfxVolume * 100));
    }
    if (this.settingsSfxValue) {
      this.settingsSfxValue.textContent = formatVolumePercent(sfxVolume);
    }

    if (this.settingsMusicSlider) {
      this.settingsMusicSlider.value = String(Math.round(musicVolume * 100));
    }
    if (this.settingsMusicValue) {
      this.settingsMusicValue.textContent = formatVolumePercent(musicVolume);
    }

    const activePresetId = this.getActiveControlPresetId();
    this.controlPresetId = activePresetId;
    this.inputSystem?.setControlPreset?.(activePresetId);

    if (this.settingsControlPresetButtons) {
      this.settingsControlPresetButtons.forEach((buttonNode, presetId) => {
        const selected = presetId === activePresetId;
        buttonNode.classList.toggle("is-selected", selected);
        buttonNode.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    }
    this.renderSettingsControlGuide();
    if (this.settingsLanguageButtons) {
      const selectedLanguage = getLanguage();
      this.settingsLanguageButtons.forEach((buttonNode, languageCode) => {
        const selected = languageCode === selectedLanguage;
        buttonNode.classList.toggle("is-selected", selected);
        buttonNode.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    }

    const sectionToApply = Object.values(SETTINGS_SECTION_IDS).includes(
      this.settingsActiveSection
    )
      ? this.settingsActiveSection
      : SETTINGS_SECTION_IDS.VOLUME;
    this.setSettingsSection(sectionToApply);

    this.syncAudioToggleUi();
  },

  openSettingsModal(options = {}) {
    if (!this.settingsRoot) return;

    this.closeGarageModal({ apply: false, silent: true });

    const mode = options.mode === "entry" ? "entry" : "lobby";
    this.settingsOpenMode = mode;
    this.settingsRoot.classList.toggle("is-entry-mode", mode === "entry");
    this.lobbyCardNode?.classList.toggle("is-settings-screen", mode === "entry");
    this.settingsRoot.style.display = "flex";
    this.settingsRoot.classList.add("is-open");
    this.setSettingsSection(SETTINGS_SECTION_IDS.VOLUME);
    this.syncSettingsUi();

    if (mode === "entry" && this.nameEntryRoot) {
      this.nameEntryRoot.style.display = "none";
    }

    this.setLobbyMessage(
      mode === "entry"
        ? t(
            "messages.settingsOpenedEntry",
            {},
            "Ajustes abiertos: volumen, controles e idioma listos para configurar."
          )
        : t(
            "messages.settingsOpened",
            {},
            "Ajustes abiertos: ajusta volumen, preset de controles e idioma del lobby."
          ),
      "#8ad6ff"
    );
    this.blurNameEntry();
    this.syncKeyboardCaptureState();
  },

  closeSettingsModal(options = {}) {
    const { silent = false } = options;
    if (!this.settingsRoot) return;

    const openMode = this.settingsOpenMode || "lobby";
    this.settingsRoot.classList.remove("is-open");
    this.settingsRoot.classList.remove("is-entry-mode");
    this.settingsRoot.style.display = "none";
    this.lobbyCardNode?.classList.remove("is-settings-screen");

    if (openMode === "entry" && this.nameEntryRoot && !this.isRegistered) {
      this.nameEntryRoot.style.display = "flex";
      this.setNameEntryMode("main");
      this.extraActionButton?.focus?.();
    }

    if (!silent) {
      this.setLobbyMessage(
        this.isRegistered
          ? t(
              "messages.settingsClosed",
              {},
              "Ajustes cerrados. Los cambios quedaron guardados."
            )
          : t("messages.entryDefault", {}, "Escribe username y elige publica o privada.")
      );
    }

    this.settingsOpenMode = "lobby";
    this.syncKeyboardCaptureState();
  },

  openGarageModal(options = {}) {
    if (!this.garageRoot) return;
    this.closeSettingsModal({ silent: true });
    const mode = options.mode === "entry" ? "entry" : "lobby";
    this.garageOpenMode = mode;
    this.garageWorkingMotoId = getGarageMotoById(this.selectedGarageMotoId).id;
    this.garageRoot.classList.toggle("is-entry-mode", mode === "entry");
    this.lobbyCardNode?.classList.toggle("is-garage-screen", mode === "entry");
    this.syncGarageSelectionUi();
    this.garageRoot.style.display = "flex";
    this.garageRoot.classList.add("is-open");
    if (mode === "entry" && this.nameEntryRoot) {
      this.nameEntryRoot.style.display = "none";
    }
    this.setLobbyMessage(
      mode === "entry"
        ? t(
            "messages.garageOpenedEntry",
            {},
            "Garage abierto: elige tu moto, aplica o cierra para volver."
          )
        : t(
            "messages.garageOpened",
            {},
            "Garage abierto: cambia tu skin antes de iniciar."
          ),
      "#d8b7ff"
    );
    this.blurNameEntry();
    this.syncKeyboardCaptureState();
  },

  closeGarageModal(options = {}) {
    const { apply = false, silent = false } = options;
    if (!this.garageRoot) return;
    const openMode = this.garageOpenMode || "lobby";

    if (apply) {
      const selectedMoto = getGarageMotoById(this.garageWorkingMotoId);
      this.selectedGarageMotoId = saveSelectedGarageMotoId(selectedMoto.id);
      this.selectedGarageMotoTextureKey = selectedMoto.textureKey;
      this.garageSelectionWasManual = true;
      if (this.currentLobbyState && Array.isArray(this.currentLobbyState.players)) {
        this.currentLobbyState = {
          ...this.currentLobbyState,
          players: this.currentLobbyState.players.map((player) =>
            player.id === this.multiplayer?.selfId
              ? { ...player, motoId: selectedMoto.id }
              : player
          ),
        };
      }
      if (this.isRegistered && !this.matchRunning) {
        this.multiplayer?.emitSetGarageMoto?.(selectedMoto.id);
      }
      if (!silent) {
        this.setLobbyMessage(
          t(
            "messages.garageApplied",
            { moto: selectedMoto.label },
            `Garage aplicado: ${selectedMoto.label}.`
          ),
          "#d8b7ff"
        );
      }
    } else if (!silent && openMode === "entry") {
      this.setLobbyMessage(
        t("messages.entryDefault", {}, "Escribe username y elige publica o privada.")
      );
    }

    this.garageRoot.classList.remove("is-open");
    this.garageRoot.classList.remove("is-entry-mode");
    this.garageRoot.style.display = "none";
    this.lobbyCardNode?.classList.remove("is-garage-screen");
    if (openMode === "entry" && this.nameEntryRoot && !this.isRegistered) {
      this.nameEntryRoot.style.display = "flex";
      this.setNameEntryMode("main");
      this.futureActionButton?.focus?.();
    }
    this.refreshLobbyGaragePreview();
    this.garageOpenMode = "lobby";
    this.syncKeyboardCaptureState();
  },

  createSettingsUi() {
    if (!this.lobbyCardNode) return;
    this.controlPresetId = loadControlPresetId();
    this.inputSystem?.setControlPreset?.(this.controlPresetId);
    this.settingsTextNodes = {};

    this.settingsRoot = document.createElement("div");
    this.settingsRoot.className = "lhl-settings-modal";
    this.settingsRoot.style.display = "none";

    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "lhl-settings-backdrop";
    backdrop.setAttribute("aria-label", t("buttons.close", {}, "Cerrar ajustes"));
    backdrop.addEventListener("click", () => {
      this.closeSettingsModal();
    });

    const shell = document.createElement("div");
    shell.className = "lhl-settings-shell";

    const header = document.createElement("div");
    header.className = "lhl-settings-header";

    const eyebrow = document.createElement("div");
    eyebrow.className = "lhl-settings-eyebrow";
    eyebrow.textContent = t("buttons.settings", {}, "Ajustes");
    this.settingsEyebrowText = eyebrow;

    const title = document.createElement("div");
    title.className = "lhl-settings-title";
    title.textContent = t("settings.title", {}, "Audio y controles");
    this.settingsTitleText = title;

    const subtitle = document.createElement("div");
    subtitle.className = "lhl-settings-subtitle";
    subtitle.textContent = t(
      "settings.subtitle",
      {},
      "Cambios rapidos para volumen y esquema de teclas. Se guardan al instante."
    );
    this.settingsSubtitleText = subtitle;

    header.appendChild(eyebrow);
    header.appendChild(title);
    header.appendChild(subtitle);

    this.settingsSectionsRoot = document.createElement("div");
    this.settingsSectionsRoot.className = "lhl-settings-sections";

    this.settingsVolumeSectionButton = document.createElement("button");
    this.settingsVolumeSectionButton.type = "button";
    this.settingsVolumeSectionButton.className =
      "lhl-btn lhl-btn-minimal lhl-settings-section-btn";
    setLobbyButtonLabel(
      this.settingsVolumeSectionButton,
      t("settings.sectionVolume", {}, "Volumen")
    );
    this.settingsVolumeSectionButton.addEventListener("click", () => {
      this.setSettingsSection(SETTINGS_SECTION_IDS.VOLUME);
    });

    this.settingsControlsSectionButton = document.createElement("button");
    this.settingsControlsSectionButton.type = "button";
    this.settingsControlsSectionButton.className =
      "lhl-btn lhl-btn-minimal lhl-settings-section-btn";
    setLobbyButtonLabel(
      this.settingsControlsSectionButton,
      t("settings.sectionControls", {}, "Controles")
    );
    this.settingsControlsSectionButton.addEventListener("click", () => {
      this.setSettingsSection(SETTINGS_SECTION_IDS.CONTROLS);
    });

    this.settingsLanguageSectionButton = document.createElement("button");
    this.settingsLanguageSectionButton.type = "button";
    this.settingsLanguageSectionButton.className =
      "lhl-btn lhl-btn-minimal lhl-settings-section-btn";
    setLobbyButtonLabel(
      this.settingsLanguageSectionButton,
      t("settings.sectionLanguage", {}, "Idioma")
    );
    this.settingsLanguageSectionButton.addEventListener("click", () => {
      this.setSettingsSection(SETTINGS_SECTION_IDS.LANGUAGE);
    });

    this.settingsSectionsRoot.appendChild(this.settingsVolumeSectionButton);
    this.settingsSectionsRoot.appendChild(this.settingsControlsSectionButton);
    this.settingsSectionsRoot.appendChild(this.settingsLanguageSectionButton);

    const createVolumeCard = (config) => {
      const card = document.createElement("section");
      card.className = `lhl-settings-card ${config.cardClass || ""}`.trim();

      const cardTitle = document.createElement("div");
      cardTitle.className = "lhl-settings-card-title";
      cardTitle.textContent = config.title;

      const cardDescription = document.createElement("div");
      cardDescription.className = "lhl-settings-card-description";
      cardDescription.textContent = config.description;

      const controlWrap = document.createElement("div");
      controlWrap.className = "lhl-settings-control";

      const topRow = document.createElement("div");
      topRow.className = "lhl-settings-control-top";

      const label = document.createElement("div");
      label.className = "lhl-settings-label";
      label.textContent = config.label;

      const value = document.createElement("div");
      value.className = "lhl-settings-value";
      value.textContent = "0%";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.step = "1";
      slider.className = "lhl-settings-slider";

      topRow.appendChild(label);
      topRow.appendChild(value);
      controlWrap.appendChild(topRow);
      controlWrap.appendChild(slider);
      card.appendChild(cardTitle);
      card.appendChild(cardDescription);
      card.appendChild(controlWrap);

      return { card, slider, value, cardTitle, cardDescription, label };
    };

    this.settingsVolumePanel = document.createElement("div");
    this.settingsVolumePanel.className = "lhl-settings-panel lhl-settings-panel--volume";

    const settingsGrid = document.createElement("div");
    settingsGrid.className = "lhl-settings-grid";

    const musicCard = createVolumeCard({
      cardClass: "lhl-settings-card--music",
      title: t("settings.musicTitle", {}, "Musica del lobby"),
      description: t(
        "settings.musicDescription",
        {},
        "Intro fija al entrar y transiciones suaves entre variaciones del track del lobby."
      ),
      label: t("settings.musicVolumeLabel", {}, "Volumen music"),
    });
    this.settingsMusicSlider = musicCard.slider;
    this.settingsMusicValue = musicCard.value;
    this.settingsTextNodes.musicTitle = musicCard.cardTitle;
    this.settingsTextNodes.musicDescription = musicCard.cardDescription;
    this.settingsTextNodes.musicLabel = musicCard.label;

    const sfxCard = createVolumeCard({
      cardClass: "lhl-settings-card--sfx",
      title: t("settings.sfxTitle", {}, "Efectos de interfaz"),
      description: t(
        "settings.sfxDescription",
        {},
        "Hover, click y teclado. El control afecta los sonidos cortos del UI en todo el lobby."
      ),
      label: t("settings.sfxVolumeLabel", {}, "Volumen SFX"),
    });
    this.settingsSfxSlider = sfxCard.slider;
    this.settingsSfxValue = sfxCard.value;
    this.settingsTextNodes.sfxTitle = sfxCard.cardTitle;
    this.settingsTextNodes.sfxDescription = sfxCard.cardDescription;
    this.settingsTextNodes.sfxLabel = sfxCard.label;

    settingsGrid.appendChild(musicCard.card);
    settingsGrid.appendChild(sfxCard.card);

    const previewCard = document.createElement("section");
    previewCard.className = "lhl-settings-card lhl-settings-card--preview";

    const previewTitle = document.createElement("div");
    previewTitle.className = "lhl-settings-card-title";
    previewTitle.textContent = t("settings.previewTitle", {}, "Pruebas de pista");
    this.settingsTextNodes.previewTitle = previewTitle;

    const previewDescription = document.createElement("div");
    previewDescription.className = "lhl-settings-card-description";
    previewDescription.textContent = t(
      "settings.previewDescription",
      {},
      "Lanza una pista especifica para revisar audio y las motos decorativas sin esperar la rotacion."
    );
    this.settingsTextNodes.previewDescription = previewDescription;

    const previewGrid = document.createElement("div");
    previewGrid.className = "lhl-settings-preview-grid";

    const dynamicTrackPreviewLabels = appAudioManager.getLobbyTrackPreviewLabels?.();
    const trackPreviewLabels =
      Array.isArray(dynamicTrackPreviewLabels) && dynamicTrackPreviewLabels.length
        ? dynamicTrackPreviewLabels
        : DEFAULT_LOBBY_TRACK_PREVIEW_LABELS;

    this.settingsTrackPreviewButtons = trackPreviewLabels.map((trackLabel) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lhl-btn lhl-btn-minimal lhl-settings-track-btn";
      setLobbyButtonLabel(button, trackLabel);
      button.addEventListener("click", () => {
        if (appAudioManager.getMusicMuted()) {
          appAudioManager.setMusicMuted(false);
        }
        appAudioManager.previewLobbyTrack(trackLabel);
        this.syncAudioToggleUi();
        this.syncSettingsUi();
      });
      bindDomInputNode(this, button);
      previewGrid.appendChild(button);
      return button;
    });

    previewCard.appendChild(previewTitle);
    previewCard.appendChild(previewDescription);
    previewCard.appendChild(previewGrid);
    settingsGrid.appendChild(previewCard);
    this.settingsVolumePanel.appendChild(settingsGrid);

    const note = document.createElement("div");
    note.className = "lhl-settings-note";
    note.textContent = t(
      "settings.tipAutoplay",
      {},
      "Tip: si el navegador bloquea autoplay, la musica arrancara al primer click o tecla."
    );
    this.settingsTextNodes.autoplayTip = note;
    this.settingsVolumePanel.appendChild(note);

    this.settingsControlsPanel = document.createElement("div");
    this.settingsControlsPanel.className = "lhl-settings-panel lhl-settings-panel--controls";

    const controlsCard = document.createElement("section");
    controlsCard.className = "lhl-settings-card lhl-settings-card--controls";

    const controlsTitle = document.createElement("div");
    controlsTitle.className = "lhl-settings-card-title";
    controlsTitle.textContent = t("settings.controlsTitle", {}, "Preset de controles");
    this.settingsTextNodes.controlsTitle = controlsTitle;

    const controlsDescription = document.createElement("div");
    controlsDescription.className = "lhl-settings-card-description";
    controlsDescription.textContent = t(
      "settings.controlsDescription",
      {},
      "Elige el esquema para jugar. Se usa dentro de partida al instante."
    );
    this.settingsTextNodes.controlsDescription = controlsDescription;

    const controlsPresetGrid = document.createElement("div");
    controlsPresetGrid.className = "lhl-settings-preset-grid";
    this.settingsControlPresetButtons = new Map();

    const buildPresetButton = (presetId) => {
      const preset = getControlPreset(presetId);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lhl-btn lhl-btn-minimal lhl-settings-preset-btn";
      setLobbyButtonLabel(button, getLocalizedControlPresetLabel(preset.id));
      button.addEventListener("click", () => {
        this.applyControlPreset(preset.id);
      });
      bindDomInputNode(this, button);
      this.settingsControlPresetButtons.set(preset.id, button);
      controlsPresetGrid.appendChild(button);
    };
    buildPresetButton(CONTROL_PRESET_IDS.ARROWS);
    buildPresetButton(CONTROL_PRESET_IDS.WASD);

    this.settingsControlGuideTitle = document.createElement("div");
    this.settingsControlGuideTitle.className = "lhl-settings-controls-title";
    this.settingsControlGuideTitle.textContent = t(
      "settings.controlsGuideTitle",
      { preset: getLocalizedControlPresetLabel(this.getActiveControlPresetId()) },
      "Guia activa"
    );

    this.settingsControlGuideGrid = document.createElement("div");
    this.settingsControlGuideGrid.className = "lhl-settings-controls-guide";

    controlsCard.appendChild(controlsTitle);
    controlsCard.appendChild(controlsDescription);
    controlsCard.appendChild(controlsPresetGrid);
    controlsCard.appendChild(this.settingsControlGuideTitle);
    controlsCard.appendChild(this.settingsControlGuideGrid);
    this.settingsControlsPanel.appendChild(controlsCard);

    this.settingsLanguagePanel = document.createElement("div");
    this.settingsLanguagePanel.className = "lhl-settings-panel lhl-settings-panel--language";
    this.settingsLanguageButtons = new Map();

    const languageCard = document.createElement("section");
    languageCard.className = "lhl-settings-card lhl-settings-card--controls";

    const languageTitle = document.createElement("div");
    languageTitle.className = "lhl-settings-card-title";
    languageTitle.textContent = t("settings.languageTitle", {}, "Idioma");
    this.settingsTextNodes.languageTitle = languageTitle;

    const languageDescription = document.createElement("div");
    languageDescription.className = "lhl-settings-card-description";
    languageDescription.textContent = t(
      "settings.languageDescription",
      {},
      "Selecciona idioma y aplica al momento en botones y mensajes del lobby."
    );
    this.settingsTextNodes.languageDescription = languageDescription;

    const languageGrid = document.createElement("div");
    languageGrid.className = "lhl-settings-preset-grid";

    getAvailableLanguages().forEach((languageCode) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lhl-btn lhl-btn-minimal lhl-settings-preset-btn";
      setLobbyButtonLabel(
        button,
        getLanguageLabel(languageCode, String(languageCode || "").toUpperCase())
      );
      button.addEventListener("click", () => {
        this.applyLanguageSelection(languageCode);
      });
      bindDomInputNode(this, button);
      this.settingsLanguageButtons.set(languageCode, button);
      languageGrid.appendChild(button);
    });

    languageCard.appendChild(languageTitle);
    languageCard.appendChild(languageDescription);
    languageCard.appendChild(languageGrid);
    this.settingsLanguagePanel.appendChild(languageCard);

    const footer = document.createElement("div");
    footer.className = "lhl-settings-footer";

    this.settingsPreviewMusicButton = document.createElement("button");
    this.settingsPreviewMusicButton.type = "button";
    this.settingsPreviewMusicButton.className = "lhl-btn lhl-btn-alt lhl-settings-preview-btn";
    setLobbyButtonLabel(
      this.settingsPreviewMusicButton,
      t("buttons.startMusic", {}, "Iniciar musica")
    );
    this.settingsPreviewMusicButton.addEventListener("click", () => {
      if (appAudioManager.getMusicMuted()) {
        appAudioManager.setMusicMuted(false);
      }
      appAudioManager.restartLobbyMusic();
      this.syncAudioToggleUi();
      this.syncSettingsUi();
    });

    this.settingsCloseButton = document.createElement("button");
    this.settingsCloseButton.type = "button";
    this.settingsCloseButton.className = "lhl-btn lhl-btn-minimal lhl-settings-close-btn";
    setLobbyButtonLabel(this.settingsCloseButton, t("buttons.close", {}, "Cerrar"));
    this.settingsCloseButton.addEventListener("click", () => {
      this.closeSettingsModal();
    });

    const applySliderValue = (slider, setter, valueNode) => {
      const normalized = clampVolumeSetting(Number(slider.value || 0) / 100, 1);
      setter(normalized);
      if (valueNode) {
        valueNode.textContent = formatVolumePercent(normalized);
      }
    };

    this.settingsMusicSlider.addEventListener("input", () => {
      applySliderValue(
        this.settingsMusicSlider,
        (value) => appAudioManager.setMusicVolume(value),
        this.settingsMusicValue
      );
    });
    this.settingsSfxSlider.addEventListener("input", () => {
      applySliderValue(
        this.settingsSfxSlider,
        (value) => appAudioManager.setSfxVolume(value),
        this.settingsSfxValue
      );
    });

    bindDomInputNode(this, this.settingsVolumeSectionButton);
    bindDomInputNode(this, this.settingsControlsSectionButton);
    bindDomInputNode(this, this.settingsLanguageSectionButton);
    bindDomInputNode(this, this.settingsMusicSlider);
    bindDomInputNode(this, this.settingsSfxSlider);
    bindDomInputNode(this, this.settingsPreviewMusicButton);
    bindDomInputNode(this, this.settingsCloseButton);

    footer.appendChild(this.settingsPreviewMusicButton);
    footer.appendChild(this.settingsCloseButton);

    shell.appendChild(header);
    shell.appendChild(this.settingsSectionsRoot);
    shell.appendChild(this.settingsVolumePanel);
    shell.appendChild(this.settingsControlsPanel);
    shell.appendChild(this.settingsLanguagePanel);
    shell.appendChild(footer);

    this.settingsRoot.appendChild(backdrop);
    this.settingsRoot.appendChild(shell);
    this.lobbyCardNode.appendChild(this.settingsRoot);

    this.settingsQuickButton = document.createElement("button");
    this.settingsQuickButton.type = "button";
    this.settingsQuickButton.className = "lhl-btn lhl-btn-settings lhl-btn-share";
    this.settingsQuickButton.style.display = "none";
    setLobbyButtonLabel(this.settingsQuickButton, t("buttons.settings", {}, "Ajustes"));
    this.settingsQuickButton.addEventListener("click", () => {
      this.openSettingsModal({ mode: "lobby" });
    });
    bindDomInputNode(this, this.settingsQuickButton);
    this.lobbyGarageActionMount?.appendChild(this.settingsQuickButton);

    this.settingsActiveSection = SETTINGS_SECTION_IDS.VOLUME;
    this.applySettingsTranslations?.();
    this.syncSettingsUi();
  },

  createAudioToggleUi() {
    if (!this.lobbyRoot || this.audioDockRoot) return;

    this.audioDockRoot = document.createElement("div");
    this.audioDockRoot.className = "lhl-audio-dock";

    this.musicMuteToggleButton = createAudioToggleButton({
      kind: "music",
      label: "MUS",
    });
    this.musicMuteToggleButton.addEventListener("click", () => {
      appAudioManager.toggleMusicMuted();
      this.syncAudioToggleUi();
      this.syncSettingsUi();
    });

    this.sfxMuteToggleButton = createAudioToggleButton({
      kind: "sfx",
      label: "SFX",
    });
    this.sfxMuteToggleButton.addEventListener("click", () => {
      appAudioManager.toggleSfxMuted();
      this.syncAudioToggleUi();
      this.syncSettingsUi();
    });

    bindDomInputNode(this, this.musicMuteToggleButton);
    bindDomInputNode(this, this.sfxMuteToggleButton);

    this.lobbyTrackDebugNode = document.createElement("div");
    this.lobbyTrackDebugNode.className = "lhl-track-debug";
    this.lobbyTrackDebugNode.textContent = appAudioManager.getLobbyTrackLabel();

    this.audioDockRoot.appendChild(this.musicMuteToggleButton);
    this.audioDockRoot.appendChild(this.sfxMuteToggleButton);
    this.lobbyRoot.appendChild(this.audioDockRoot);
    this.lobbyRoot.appendChild(this.lobbyTrackDebugNode);

    const applyTrackLabel = (label) => {
      if (!this.lobbyTrackDebugNode) return;
      this.lobbyTrackDebugNode.textContent = label || "Musica: silencio";
    };
    const applyTrackState = (state) => {
      this.lobbyMotoAmbientController?.setTrackState(state);
    };

    appAudioManager.setLobbyTrackLabelListener(applyTrackLabel);
    appAudioManager.setLobbyTrackStateListener(applyTrackState);
    this.syncAudioToggleUi();
  },

  destroyAudioToggleUi() {
    appAudioManager.setLobbyTrackLabelListener(null);
    appAudioManager.setLobbyTrackStateListener(null);
    this.audioDockRoot?.remove?.();
    this.lobbyTrackDebugNode?.remove?.();
    this.audioDockRoot = null;
    this.musicMuteToggleButton = null;
    this.sfxMuteToggleButton = null;
    this.lobbyTrackDebugNode = null;
  },

  createGarageUi() {
    if (!this.lobbyCardNode) return;

    const selectedMoto = getSelectedGarageMotoConfig(this.selectedGarageMotoId);
    this.selectedGarageMotoId = selectedMoto.id;
    this.selectedGarageMotoTextureKey = selectedMoto.textureKey;
    this.garageWorkingMotoId = selectedMoto.id;

    this.garageRoot = document.createElement("div");
    this.garageRoot.className = "lhl-garage-modal";
    this.garageRoot.style.display = "none";

    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "lhl-garage-backdrop";
    backdrop.setAttribute("aria-label", t("buttons.close", {}, "Cerrar garage"));
    backdrop.addEventListener("click", () => {
      this.closeGarageModal({ apply: false });
    });

    const shell = document.createElement("div");
    shell.className = "lhl-garage-shell";

    const header = document.createElement("div");
    header.className = "lhl-garage-header";

    const headerTop = document.createElement("div");
    headerTop.className = "lhl-garage-header-top";

    const eyebrow = document.createElement("div");
    eyebrow.className = "lhl-garage-eyebrow";
    eyebrow.textContent = t("buttons.garage", {}, "Garage");

    const title = document.createElement("div");
    title.className = "lhl-garage-title";
    title.textContent = t("garage.title", {}, "Elige tu moto");

    const subtitle = document.createElement("div");
    subtitle.className = "lhl-garage-subtitle";
    subtitle.textContent = t(
      "garage.subtitle",
      {},
      "Selecciona una skin y aplicala al instante."
    );

    headerTop.appendChild(eyebrow);
    header.appendChild(headerTop);
    header.appendChild(title);
    header.appendChild(subtitle);

    const body = document.createElement("div");
    body.className = "lhl-garage-body";

    const previewPane = document.createElement("div");
    previewPane.className = "lhl-garage-preview";

    const previewLabel = document.createElement("div");
    previewLabel.className = "lhl-garage-section-label";
    previewLabel.textContent = t("garage.yourBike", {}, "Tu moto");

    const previewStage = document.createElement("div");
    previewStage.className = "lhl-garage-stage";

    this.garagePreviewImage = document.createElement("img");
    this.garagePreviewImage.className = "lhl-garage-stage-image";

    this.garagePreviewName = document.createElement("div");
    this.garagePreviewName.className = "lhl-garage-preview-name";

    previewStage.appendChild(this.garagePreviewImage);
    previewPane.appendChild(previewLabel);
    previewPane.appendChild(previewStage);
    previewPane.appendChild(this.garagePreviewName);

    const optionsPane = document.createElement("div");
    optionsPane.className = "lhl-garage-options";

    const optionsLabel = document.createElement("div");
    optionsLabel.className = "lhl-garage-section-label";
    optionsLabel.textContent = t("garage.skins", {}, "Skins");

    const optionsGrid = document.createElement("div");
    optionsGrid.className = "lhl-garage-grid";

    this.garageOptionButtons = GARAGE_MOTOS.map((motoConfig) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lhl-garage-option";
      button.dataset.motoId = motoConfig.id;

      const image = document.createElement("img");
      image.className = "lhl-garage-option-image";
      image.src = motoConfig.previewSrc;
      image.alt = motoConfig.label;

      const label = document.createElement("span");
      label.className = "lhl-garage-option-label";
      label.textContent = motoConfig.label;

      button.appendChild(image);
      button.appendChild(label);
      button.addEventListener("click", () => {
        this.garageWorkingMotoId = motoConfig.id;
        this.syncGarageSelectionUi();
      });
      bindDomInputNode(this, button);
      optionsGrid.appendChild(button);
      return button;
    });

    optionsPane.appendChild(optionsLabel);
    optionsPane.appendChild(optionsGrid);

    this.garageRosterList = null;

    body.appendChild(previewPane);
    body.appendChild(optionsPane);

    const footer = document.createElement("div");
    footer.className = "lhl-garage-footer";

    this.garageApplyButton = document.createElement("button");
    this.garageApplyButton.type = "button";
    this.garageApplyButton.className = "lhl-btn lhl-btn-alt lhl-garage-apply";
    setLobbyButtonLabel(this.garageApplyButton, t("buttons.apply", {}, "Aplicar"));
    this.garageApplyButton.addEventListener("click", () => {
      this.closeGarageModal({ apply: true });
    });
    bindDomInputNode(this, this.garageApplyButton);

    this.garageCloseButton = document.createElement("button");
    this.garageCloseButton.type = "button";
    this.garageCloseButton.className =
      "lhl-btn lhl-btn-minimal lhl-garage-close-btn";
    setLobbyButtonLabel(this.garageCloseButton, t("buttons.close", {}, "Cerrar"));
    this.garageCloseButton.addEventListener("click", () => {
      this.closeGarageModal({ apply: false });
    });
    bindDomInputNode(this, this.garageCloseButton);

    footer.appendChild(this.garageApplyButton);
    footer.appendChild(this.garageCloseButton);

    shell.appendChild(header);
    shell.appendChild(body);
    shell.appendChild(footer);

    this.garageRoot.appendChild(backdrop);
    this.garageRoot.appendChild(shell);
    this.lobbyCardNode.appendChild(this.garageRoot);
    this.syncGarageSelectionUi();
    this.refreshGarageRosterUi();
  },

  createLeaveRoomUi() {
    this.leaveRoomRoot = document.createElement("div");
    this.leaveRoomRoot.className = "lhl-leave-wrap";
    this.leaveRoomRoot.style.display = "none";

    this.leaveRoomButton = document.createElement("button");
    this.leaveRoomButton.type = "button";
    this.leaveRoomButton.className = "lhl-btn lhl-btn-leave";
    setLobbyButtonLabel(this.leaveRoomButton, t("buttons.exit", {}, "Salir"));
    this.leaveRoomButton.addEventListener("click", () => this.leaveCurrentRoom());
    bindDomInputNode(this, this.leaveRoomButton);

    this.leaveRoomRoot.appendChild(this.leaveRoomButton);
    if (this.lobbyActionsMount) {
      this.lobbyActionsMount.prepend(this.leaveRoomRoot);
    }
  },

  createRoomShareUi() {
    this.roomShareRoot = document.createElement("div");
    this.roomShareRoot.className = "lhl-share";
    this.roomShareRoot.style.display = "none";

    this.roomShareActions = document.createElement("div");
    this.roomShareActions.className = "lhl-share-actions";

    this.roomShareLabel = document.createElement("div");
    this.roomShareLabel.textContent = t("labels.roomCode", {}, "Codigo de sala");
    this.roomShareLabel.className = "lhl-share-label";

    this.roomShareCodeValue = document.createElement("div");
    this.roomShareCodeValue.className = "lhl-share-code";

    this.roomShareHint = document.createElement("div");
    this.roomShareHint.className = "lhl-share-hint";

    this.roomShareButton = document.createElement("button");
    this.roomShareButton.type = "button";
    this.roomShareButton.className = "lhl-btn lhl-btn-copy";
    setLobbyButtonLabel(this.roomShareButton, t("buttons.copyCode", {}, "Copiar codigo"));
    this.roomShareButton.addEventListener("click", () => this.copyCurrentRoomCode());
    bindDomInputNode(this, this.roomShareButton);

    this.garageQuickButton = document.createElement("button");
    this.garageQuickButton.type = "button";
    this.garageQuickButton.className = "lhl-btn lhl-btn-garage lhl-btn-share";
    this.garageQuickButton.style.display = "none";
    setLobbyButtonLabel(this.garageQuickButton, t("buttons.garage", {}, "Garage"));
    this.garageQuickButton.addEventListener("click", () => {
      this.openGarageModal({ mode: "lobby" });
    });
    bindDomInputNode(this, this.garageQuickButton);

    this.roomShareRoot.appendChild(this.roomShareLabel);
    this.roomShareRoot.appendChild(this.roomShareCodeValue);
    this.roomShareRoot.appendChild(this.roomShareHint);
    this.roomShareActions.appendChild(this.roomShareButton);
    this.roomShareRoot.appendChild(this.roomShareActions);
    if (this.lobbyShareMount) {
      this.lobbyShareMount.appendChild(this.roomShareRoot);
    }
  },

  setLeaveRoomUiVisible(visible) {
    if (!this.leaveRoomRoot) return;
    const canShow = Boolean(visible && this.isRegistered && !this.matchRunning);
    this.leaveRoomRoot.style.display = canShow ? "flex" : "none";
    this.syncKeyboardCaptureState();
  },

  leaveCurrentRoom(options = {}) {
    const allowInMatch = Boolean(options.allowInMatch);
    if (!this.isRegistered) return;
    const inLiveMatch = this.matchRunning && !this.matchEnded;
    if (inLiveMatch && !allowInMatch) return;
    const shouldResetMatchScene = Boolean(
      this.matchRunning || this.map || this.moto || this.hud
    );

    this.hud?.closeSettingsMenu?.({ silent: true });
    this.closeGarageModal({ apply: false, silent: true });
    this.closeSettingsModal({ silent: true });
    this.multiplayer?.destroy();
    this.isRegistered = false;
    this.currentLobbyState = null;
    this.pendingRoomMode = "public";
    if (shouldResetMatchScene) {
      this.resetToLobby();
    }
    this.lobbyCardNode?.classList.remove("is-private-room", "is-public-room");
    this.setLobbyVisible(true);
    this.setLeaveRoomUiVisible(false);
    this.setNameEntryBusy(null);
    this.updateRoomShareUi();

    if (this.nameEntryRoot) {
      this.nameEntryRoot.style.display = "flex";
    }
    this.setNameEntryMode("main");
    if (this.nameInput) {
      this.nameInput.disabled = false;
      if (!this.nameInput.value) {
        this.nameInput.value =
          window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ||
          window.localStorage.getItem(LEGACY_PLAYER_NAME_STORAGE_KEY) ||
          "";
      }
    }
    if (this.roomCodeInput) {
      this.roomCodeInput.disabled = false;
    }
    this.updatePrivateJoinButtonState();

    this.lobbyTitle.setText(t("labels.lobbyTitle", {}, "Sala Deliver.io"));
    this.lobbySubtitle.setText(
      t("labels.lobbySubtitle", {}, "Publica o privada | Maximo 6 jugadores")
    );
    this.lobbyPlayersPanel?.setVisible(false);
    this.playersListText.setText([]);
    this.setLobbyMessage(
      t("messages.entryDefault", {}, "Escribe username y elige publica o privada.")
    );
    this.readyButtonRect?.setVisible(false);
    this.readyButtonLabel?.setVisible(false);
    this.readyButtonRect?.disableInteractive();
    this.startButtonRect.setVisible(false);
    this.startButtonLabel.setVisible(false);
    this.startButtonRect.disableInteractive();
    this.nameInput?.focus();
    this.syncKeyboardCaptureState();
  },

  destroyNameEntryUi() {
    if (!this.nameEntryRoot) return;
    this.nameEntryRoot.remove();
    this.nameEntryRoot = null;
    this.mainActionsRoot = null;
    this.privateActionsRoot = null;
    this.nameEntryMode = "main";
    this.nameInput = null;
    this.roomCodeInput = null;
    this.publicMatchButton = null;
    this.privateModeButton = null;
    this.privateCreateButton = null;
    this.privateJoinButton = null;
    this.privateBackButton = null;
    this.extraActionButton = null;
    this.futureActionButton = null;
    this.syncKeyboardCaptureState();
  },

  destroyGarageUi() {
    if (!this.garageRoot) return;
    this.garageRoot.remove();
    this.garageRoot = null;
    this.garageOpenMode = "lobby";
    this.garagePreviewImage = null;
    this.garagePreviewName = null;
    this.garageCloseButton = null;
    this.garageRosterList = null;
    this.garageApplyButton = null;
    this.garageOptionButtons = [];
    this.garageWorkingMotoId = null;
  },

  destroySettingsUi() {
    if (!this.settingsRoot) return;
    this.settingsRoot.remove();
    this.settingsRoot = null;
    this.settingsOpenMode = "lobby";
    this.settingsActiveSection = SETTINGS_SECTION_IDS.VOLUME;
    this.settingsSectionsRoot = null;
    this.settingsVolumeSectionButton = null;
    this.settingsControlsSectionButton = null;
    this.settingsLanguageSectionButton = null;
    this.settingsVolumePanel = null;
    this.settingsControlsPanel = null;
    this.settingsLanguagePanel = null;
    this.settingsControlPresetButtons = null;
    this.settingsLanguageButtons = null;
    this.settingsControlGuideGrid = null;
    this.settingsControlGuideTitle = null;
    this.settingsEyebrowText = null;
    this.settingsTitleText = null;
    this.settingsSubtitleText = null;
    this.settingsTextNodes = null;
    this.settingsCloseButton = null;
    this.settingsPreviewMusicButton = null;
    this.settingsTrackPreviewButtons = [];
    this.settingsSfxSlider = null;
    this.settingsSfxValue = null;
    this.settingsMusicSlider = null;
    this.settingsMusicValue = null;
    this.settingsQuickButton?.remove?.();
    this.settingsQuickButton = null;
    this.lobbyCardNode?.classList.remove("is-settings-screen");
    this.syncKeyboardCaptureState();
  },

  destroyLeaveRoomUi() {
    if (!this.leaveRoomRoot) return;
    this.leaveRoomRoot.remove();
    this.leaveRoomRoot = null;
    this.leaveRoomButton = null;
    this.syncKeyboardCaptureState();
  },

  destroyRoomShareUi() {
    if (!this.roomShareRoot) return;
    if (this.roomShareCopyResetTimer) {
      window.clearTimeout(this.roomShareCopyResetTimer);
      this.roomShareCopyResetTimer = null;
    }
    this.roomShareCopyCooldownUntilMs = 0;
    this.roomShareRoot.remove();
    this.roomShareRoot = null;
    this.roomShareActions = null;
    this.roomShareLabel = null;
    this.roomShareCodeValue = null;
    this.roomShareHint = null;
    this.roomShareButton = null;
    this.garageQuickButton = null;
    this.syncKeyboardCaptureState();
  },

  createDebugFinishUi() {
    const appRoot = document.getElementById("app");
    if (!appRoot) return;

    appRoot.style.position = "relative";

    this.debugFinishRoot = document.createElement("div");
    this.debugFinishRoot.style.position = "absolute";
    this.debugFinishRoot.style.left = "18px";
    this.debugFinishRoot.style.top = "92px";
    this.debugFinishRoot.style.width = "310px";
    this.debugFinishRoot.style.display = "none";
    this.debugFinishRoot.style.flexDirection = "column";
    this.debugFinishRoot.style.gap = "8px";
    this.debugFinishRoot.style.padding = "14px";
    this.debugFinishRoot.style.border = "2px solid rgba(156, 245, 184, 0.32)";
    this.debugFinishRoot.style.borderRadius = "14px";
    this.debugFinishRoot.style.background = "rgba(8, 14, 22, 0.94)";
    this.debugFinishRoot.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.32)";
    this.debugFinishRoot.style.zIndex = "3200";

    const title = document.createElement("div");
    title.textContent = "Debug resultado";
    title.style.fontFamily = "Consolas, monospace";
    title.style.fontSize = "18px";
    title.style.fontWeight = "700";
    title.style.color = "#f4fbff";

    const hint = document.createElement("div");
    hint.textContent = "Host: simula llegadas o cierra la partida.";
    hint.style.fontFamily = "Consolas, monospace";
    hint.style.fontSize = "12px";
    hint.style.color = "#c7d6e8";
    hint.style.lineHeight = "1.4";

    const playerRow = document.createElement("div");
    playerRow.style.display = "flex";
    playerRow.style.flexDirection = "column";
    playerRow.style.gap = "4px";

    const playerLabel = document.createElement("label");
    playerLabel.textContent = "Jugador";
    playerLabel.style.fontFamily = "Consolas, monospace";
    playerLabel.style.fontSize = "12px";
    playerLabel.style.color = "#dce8f5";

    this.debugFinishPlayerSelect = document.createElement("select");
    this.debugFinishPlayerSelect.style.height = "36px";
    this.debugFinishPlayerSelect.style.padding = "0 10px";
    this.debugFinishPlayerSelect.style.border = "1px solid #5b748b";
    this.debugFinishPlayerSelect.style.borderRadius = "8px";
    this.debugFinishPlayerSelect.style.background = "#10171f";
    this.debugFinishPlayerSelect.style.color = "#eef4fb";
    this.debugFinishPlayerSelect.style.fontFamily = "Consolas, monospace";
    this.debugFinishPlayerSelect.style.fontSize = "14px";
    bindDomInputNode(this, this.debugFinishPlayerSelect);

    playerRow.appendChild(playerLabel);
    playerRow.appendChild(this.debugFinishPlayerSelect);

    const valuesRow = document.createElement("div");
    valuesRow.style.display = "grid";
    valuesRow.style.gridTemplateColumns = "1fr 1fr";
    valuesRow.style.gap = "10px";

    const qualityWrap = document.createElement("div");
    qualityWrap.style.display = "flex";
    qualityWrap.style.flexDirection = "column";
    qualityWrap.style.gap = "4px";

    const qualityLabel = document.createElement("label");
    qualityLabel.textContent = "Calidad %";
    qualityLabel.style.fontFamily = "Consolas, monospace";
    qualityLabel.style.fontSize = "12px";
    qualityLabel.style.color = "#dce8f5";

    this.debugFinishQualityInput = document.createElement("input");
    this.debugFinishQualityInput.type = "number";
    this.debugFinishQualityInput.min = "0";
    this.debugFinishQualityInput.max = "100";
    this.debugFinishQualityInput.step = "1";
    this.debugFinishQualityInput.value = "100";
    this.debugFinishQualityInput.style.height = "36px";
    this.debugFinishQualityInput.style.padding = "0 10px";
    this.debugFinishQualityInput.style.border = "1px solid #5b748b";
    this.debugFinishQualityInput.style.borderRadius = "8px";
    this.debugFinishQualityInput.style.background = "#10171f";
    this.debugFinishQualityInput.style.color = "#eef4fb";
    this.debugFinishQualityInput.style.fontFamily = "Consolas, monospace";
    this.debugFinishQualityInput.style.fontSize = "14px";

    qualityWrap.appendChild(qualityLabel);
    qualityWrap.appendChild(this.debugFinishQualityInput);

    const timeWrap = document.createElement("div");
    timeWrap.style.display = "flex";
    timeWrap.style.flexDirection = "column";
    timeWrap.style.gap = "4px";

    const timeLabel = document.createElement("label");
    timeLabel.textContent = "Tiempo s";
    timeLabel.style.fontFamily = "Consolas, monospace";
    timeLabel.style.fontSize = "12px";
    timeLabel.style.color = "#dce8f5";

    this.debugFinishTimeInput = document.createElement("input");
    this.debugFinishTimeInput.type = "number";
    this.debugFinishTimeInput.min = "0";
    this.debugFinishTimeInput.step = "0.1";
    this.debugFinishTimeInput.value = "45";
    this.debugFinishTimeInput.style.height = "36px";
    this.debugFinishTimeInput.style.padding = "0 10px";
    this.debugFinishTimeInput.style.border = "1px solid #5b748b";
    this.debugFinishTimeInput.style.borderRadius = "8px";
    this.debugFinishTimeInput.style.background = "#10171f";
    this.debugFinishTimeInput.style.color = "#eef4fb";
    this.debugFinishTimeInput.style.fontFamily = "Consolas, monospace";
    this.debugFinishTimeInput.style.fontSize = "14px";

    timeWrap.appendChild(timeLabel);
    timeWrap.appendChild(this.debugFinishTimeInput);

    valuesRow.appendChild(qualityWrap);
    valuesRow.appendChild(timeWrap);

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "grid";
    buttonRow.style.gridTemplateColumns = "1fr 1fr";
    buttonRow.style.gap = "8px";

    this.debugFinishSubmitButton = document.createElement("button");
    this.debugFinishSubmitButton.textContent = "Simular";
    this.debugFinishSubmitButton.style.height = "38px";
    this.debugFinishSubmitButton.style.border = "1px solid #8ac8ff";
    this.debugFinishSubmitButton.style.borderRadius = "8px";
    this.debugFinishSubmitButton.style.background = "#18496a";
    this.debugFinishSubmitButton.style.color = "#ffffff";
    this.debugFinishSubmitButton.style.fontFamily = "Consolas, monospace";
    this.debugFinishSubmitButton.style.fontSize = "14px";
    this.debugFinishSubmitButton.style.cursor = "pointer";

    this.debugFinishSubmitAndFinalizeButton = document.createElement("button");
    this.debugFinishSubmitAndFinalizeButton.textContent = "Simular + cerrar";
    this.debugFinishSubmitAndFinalizeButton.style.height = "38px";
    this.debugFinishSubmitAndFinalizeButton.style.border = "1px solid #ffd27d";
    this.debugFinishSubmitAndFinalizeButton.style.borderRadius = "8px";
    this.debugFinishSubmitAndFinalizeButton.style.background = "#7a4a11";
    this.debugFinishSubmitAndFinalizeButton.style.color = "#ffffff";
    this.debugFinishSubmitAndFinalizeButton.style.fontFamily = "Consolas, monospace";
    this.debugFinishSubmitAndFinalizeButton.style.fontSize = "13px";
    this.debugFinishSubmitAndFinalizeButton.style.cursor = "pointer";

    buttonRow.appendChild(this.debugFinishSubmitButton);
    buttonRow.appendChild(this.debugFinishSubmitAndFinalizeButton);

    this.debugFinishFinalizeButton = document.createElement("button");
    this.debugFinishFinalizeButton.textContent = "Cerrar partida actual";
    this.debugFinishFinalizeButton.style.height = "38px";
    this.debugFinishFinalizeButton.style.border = "1px solid #ff9f9f";
    this.debugFinishFinalizeButton.style.borderRadius = "8px";
    this.debugFinishFinalizeButton.style.background = "#6a2424";
    this.debugFinishFinalizeButton.style.color = "#ffffff";
    this.debugFinishFinalizeButton.style.fontFamily = "Consolas, monospace";
    this.debugFinishFinalizeButton.style.fontSize = "14px";
    this.debugFinishFinalizeButton.style.cursor = "pointer";

    this.debugFinishStatusText = document.createElement("div");
    this.debugFinishStatusText.textContent =
      "Score = calidad x 1.25 + max(0, 24 - 4 x difSeg).";
    this.debugFinishStatusText.style.fontFamily = "Consolas, monospace";
    this.debugFinishStatusText.style.fontSize = "11px";
    this.debugFinishStatusText.style.color = "#9fb7cc";
    this.debugFinishStatusText.style.lineHeight = "1.45";

    const submitHandler = () => this.submitDebugFinishTest(false);
    this.debugFinishSubmitButton.addEventListener("click", submitHandler);
    this.debugFinishSubmitAndFinalizeButton.addEventListener("click", () =>
      this.submitDebugFinishTest(true)
    );
    this.debugFinishFinalizeButton.addEventListener("click", () =>
      this.finalizeDebugMatchNow()
    );
    bindDomInputNode(this, this.debugFinishQualityInput, {
      onEnter: submitHandler,
    });
    bindDomInputNode(this, this.debugFinishTimeInput, {
      onEnter: submitHandler,
    });
    bindDomInputNode(this, this.debugFinishSubmitButton);
    bindDomInputNode(this, this.debugFinishSubmitAndFinalizeButton);
    bindDomInputNode(this, this.debugFinishFinalizeButton);

    this.debugFinishRoot.appendChild(title);
    this.debugFinishRoot.appendChild(hint);
    this.debugFinishRoot.appendChild(playerRow);
    this.debugFinishRoot.appendChild(valuesRow);
    this.debugFinishRoot.appendChild(buttonRow);
    this.debugFinishRoot.appendChild(this.debugFinishFinalizeButton);
    this.debugFinishRoot.appendChild(this.debugFinishStatusText);
    appRoot.appendChild(this.debugFinishRoot);

    this.refreshDebugFinishUi();
    this.syncKeyboardCaptureState();
  },

  refreshDebugFinishUi() {
    if (!this.debugFinishRoot || !this.debugFinishPlayerSelect) return;

    const previousValue = this.debugFinishPlayerSelect.value;
    const players = Array.isArray(this.currentLobbyState?.players)
      ? this.currentLobbyState.players
      : [];
    const preferredValue =
      previousValue || this.multiplayer?.selfId || players[0]?.id || "";

    this.debugFinishPlayerSelect.innerHTML = "";
    players.forEach((player) => {
      const option = document.createElement("option");
      option.value = player.id;
      option.textContent =
        player.id === this.multiplayer?.selfId
          ? `${player.name} (tu)`
          : player.name;
      this.debugFinishPlayerSelect.appendChild(option);
    });

    const hasPreferred = players.some((player) => player.id === preferredValue);
    this.debugFinishPlayerSelect.value = hasPreferred
      ? preferredValue
      : players[0]?.id || "";

    const hasPlayers = players.length > 0;
    this.debugFinishPlayerSelect.disabled = !hasPlayers;
    this.debugFinishSubmitButton.disabled = !hasPlayers;
    this.debugFinishSubmitAndFinalizeButton.disabled = !hasPlayers;
    this.debugFinishFinalizeButton.disabled = !hasPlayers;
  },

  setDebugFinishUiVisible(visible) {
    if (!this.debugFinishRoot) return;
    if (this.usingGameplayHudKit) {
      this.debugFinishRoot.style.display = "none";
      this.syncKeyboardCaptureState();
      return;
    }
    const showPanel = Boolean(visible && this.isLocalHost());
    this.debugFinishRoot.style.display = showPanel ? "flex" : "none";
    if (showPanel) {
      this.refreshDebugFinishUi();
    }
    this.syncKeyboardCaptureState();
  },

  submitDebugFinishTest(finalizeNow = false) {
    if (!this.matchRunning || this.matchEnded || !this.isLocalHost()) return;

    const playerId =
      this.debugFinishPlayerSelect?.value || this.multiplayer?.selfId || "";
    if (!playerId) return;

    const qualityPercent = Math.max(
      0,
      Math.min(100, Math.round(Number(this.debugFinishQualityInput?.value || 0)))
    );
    const elapsedSeconds = Math.max(
      0,
      Number(this.debugFinishTimeInput?.value || 0)
    );
    if (!Number.isFinite(elapsedSeconds)) return;

    this.multiplayer?.emitDebugSetFinishReport({
      playerId,
      qualityPercent,
      elapsedSeconds,
      finalizeNow,
    });

    const targetLabel =
      this.debugFinishPlayerSelect?.selectedOptions?.[0]?.textContent || "Jugador";
    this.statusBanner?.setText(
      finalizeNow
        ? `Debug: ${targetLabel} simulado y cierre enviado`
        : `Debug: ${targetLabel} simulado`
    );
    this.statusBanner?.setColor(finalizeNow ? "#ffd27d" : "#7fe7ff");
    this.statusBanner?.setVisible(true);
  },

  finalizeDebugMatchNow() {
    if (!this.matchRunning || this.matchEnded || !this.isLocalHost()) return;
    this.multiplayer?.emitDebugFinalizeMatch();
    this.statusBanner?.setText("Debug: cierre manual enviado");
    this.statusBanner?.setColor("#ffd27d");
    this.statusBanner?.setVisible(true);
  },

  destroyDebugFinishUi() {
    if (!this.debugFinishRoot) return;
    this.debugFinishRoot.remove();
    this.debugFinishRoot = null;
    this.debugFinishPlayerSelect = null;
    this.debugFinishQualityInput = null;
    this.debugFinishTimeInput = null;
    this.debugFinishSubmitButton = null;
    this.debugFinishSubmitAndFinalizeButton = null;
    this.debugFinishFinalizeButton = null;
    this.debugFinishStatusText = null;
    this.syncKeyboardCaptureState();
  },

  createLobbyReturnUi() {
    const appRoot = document.getElementById("app");
    if (!appRoot) return;

    appRoot.style.position = "relative";

    this.lobbyReturnRoot = document.createElement("div");
    this.lobbyReturnRoot.style.position = "absolute";
    this.lobbyReturnRoot.style.left = "50%";
    this.lobbyReturnRoot.style.bottom = "36px";
    this.lobbyReturnRoot.style.transform = "translateX(-50%)";
    this.lobbyReturnRoot.style.display = "none";
    this.lobbyReturnRoot.style.flexDirection = "column";
    this.lobbyReturnRoot.style.alignItems = "center";
    this.lobbyReturnRoot.style.gap = "10px";
    this.lobbyReturnRoot.style.padding = "14px 18px";
    this.lobbyReturnRoot.style.border = "2px solid rgba(255, 209, 160, 0.34)";
    this.lobbyReturnRoot.style.borderRadius = "14px";
    this.lobbyReturnRoot.style.background = "rgba(8, 14, 22, 0.94)";
    this.lobbyReturnRoot.style.zIndex = "3300";

    this.lobbyReturnText = document.createElement("div");
    this.lobbyReturnText.style.fontFamily = "Consolas, monospace";
    this.lobbyReturnText.style.fontSize = "14px";
    this.lobbyReturnText.style.color = "#f3e2c9";
    this.lobbyReturnText.style.textAlign = "center";

    this.lobbyReturnButton = document.createElement("button");
    this.lobbyReturnButton.textContent = "Regresar";
    this.lobbyReturnButton.style.height = "40px";
    this.lobbyReturnButton.style.padding = "0 18px";
    this.lobbyReturnButton.style.border = "1px solid #ffd27d";
    this.lobbyReturnButton.style.borderRadius = "8px";
    this.lobbyReturnButton.style.background = "#6d4512";
    this.lobbyReturnButton.style.color = "#ffffff";
    this.lobbyReturnButton.style.fontFamily = "Consolas, monospace";
    this.lobbyReturnButton.style.fontSize = "14px";
    this.lobbyReturnButton.style.cursor = "pointer";

    this.lobbyReplayButton = document.createElement("button");
    this.lobbyReplayButton.textContent = "Jugar de nuevo";
    this.lobbyReplayButton.style.height = "40px";
    this.lobbyReplayButton.style.padding = "0 18px";
    this.lobbyReplayButton.style.border = "1px solid #9cf5b8";
    this.lobbyReplayButton.style.borderRadius = "8px";
    this.lobbyReplayButton.style.background = "#1b6a47";
    this.lobbyReplayButton.style.color = "#ffffff";
    this.lobbyReplayButton.style.fontFamily = "Consolas, monospace";
    this.lobbyReplayButton.style.fontSize = "14px";
    this.lobbyReplayButton.style.cursor = "pointer";
    this.lobbyReplayButton.style.display = "none";

    this.lobbyReturnButton.addEventListener("click", () =>
      this.handlePostMatchBackAction()
    );
    this.lobbyReplayButton.addEventListener("click", () =>
      this.playAnotherPublicMatch()
    );
    bindDomInputNode(this, this.lobbyReturnButton);
    bindDomInputNode(this, this.lobbyReplayButton);

    this.lobbyReturnRoot.appendChild(this.lobbyReturnText);
    this.lobbyReturnRoot.appendChild(this.lobbyReturnButton);
    this.lobbyReturnRoot.appendChild(this.lobbyReplayButton);
    appRoot.appendChild(this.lobbyReturnRoot);
  },

  updateLobbyReturnUi() {
    if (!this.lobbyReturnRoot || this.lobbyReturnRoot.style.display === "none") return;
    if (this.usingGameplayHudKit) return;

    const roomType =
      this.currentLobbyState?.roomType || this.multiplayer?.getRoomInfo?.()?.roomType;
    const isPublicRoom = roomType === "public";
    if (isPublicRoom) {
      this.lobbyReturnText.textContent = "Partida publica finalizada.";
      this.lobbyReturnButton.textContent = "Regresar";
      if (this.lobbyReplayButton) {
        this.lobbyReplayButton.style.display = "inline-flex";
      }
      return;
    }

    this.lobbyReturnButton.textContent = "Regresar al lobby";
    if (this.lobbyReplayButton) {
      this.lobbyReplayButton.style.display = "none";
    }

    const remainingMs = this.lobbyReturnAtMs
      ? Math.max(0, this.lobbyReturnAtMs - Date.now())
      : 0;
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    this.lobbyReturnText.textContent =
      remainingSeconds > 0
        ? `Lobby automatico en ${remainingSeconds}s`
        : "Lobby automatico en curso...";
  },

  setLobbyReturnUiVisible(visible) {
    if (!this.lobbyReturnRoot) return;
    if (this.usingGameplayHudKit) {
      this.lobbyReturnRoot.style.display = "none";
      this.syncKeyboardCaptureState();
      return;
    }
    this.lobbyReturnRoot.style.display = visible ? "flex" : "none";
    if (visible) {
      this.updateLobbyReturnUi();
    } else if (this.lobbyReplayButton) {
      this.lobbyReplayButton.style.display = "none";
    }
    this.syncKeyboardCaptureState();
  },

  handlePostMatchBackAction() {
    if (!this.matchEnded) return;
    const roomType =
      this.currentLobbyState?.roomType || this.multiplayer?.getRoomInfo?.()?.roomType;
    if (roomType === "public") {
      this.exitMatchToMainLobby(false);
      return;
    }
    this.requestLobbyReturn();
  },

  playAnotherPublicMatch() {
    if (!this.matchEnded) return;
    this.exitMatchToMainLobby(true);
  },

  exitMatchToMainLobby(autoQueuePublic = false) {
    const cachedName = (
      this.nameInput?.value?.trim() ||
      window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_PLAYER_NAME_STORAGE_KEY) ||
      "Jugador"
    ).slice(0, USERNAME_MAX_LENGTH);

    this.multiplayer?.destroy();
    this.isRegistered = false;
    this.currentLobbyState = null;
    this.pendingRoomMode = "public";
    this.roomCodeValue = "";
    this.lobbyReturnAtMs = 0;
    this.setNameEntryBusy(null);
    this.resetToLobby?.();

    if (this.nameEntryRoot) {
      this.nameEntryRoot.style.display = "flex";
    }
    if (this.nameInput) {
      this.nameInput.disabled = false;
      this.nameInput.value = cachedName;
    }
    if (this.roomCodeInput) {
      this.roomCodeInput.disabled = false;
      this.roomCodeInput.value = "";
    }
    this.setNameEntryMode("main");
    this.updatePrivateJoinButtonState();
    if (!autoQueuePublic) {
      this.setLobbyMessage(
        t("messages.entryDefault", {}, "Escribe username y elige publica o privada.")
      );
      this.nameInput?.focus();
      return;
    }
    this.submitNameEntry("public");
  },

  requestLobbyReturn() {
    if (!this.matchEnded) return;
    this.multiplayer?.emitRequestLobbyReturn();
    this.lobbyReturnText.textContent = t(
      "messages.returningLobby",
      {},
      "Regresando al lobby..."
    );
  },

  destroyLobbyReturnUi() {
    if (!this.lobbyReturnRoot) return;
    this.lobbyReturnRoot.remove();
    this.lobbyReturnRoot = null;
    this.lobbyReturnText = null;
    this.lobbyReturnButton = null;
    this.lobbyReplayButton = null;
    this.syncKeyboardCaptureState();
  },

  createLobbyUi() {
    const appRoot = document.getElementById("app");
    if (!appRoot) return;

    appRoot.style.position = "relative";

    this.lobbyRoot = document.createElement("section");
    this.lobbyRoot.className = "lhl-root";
    this.lobbyRoot.innerHTML = `
      <div class="lhl-bg"></div>
      <div class="lhl-texture"></div>
      <div class="lhl-glow"></div>
      <div class="lhl-wrap">
        <div class="lhl-logo">Deliver<span>.io</span></div>
        <div class="lhl-card" data-ref="lobbyCard">
          <div class="lhl-header">
            <div class="lhl-title" data-ref="lobbyTitle">${t("labels.lobbyTitle", {}, "Sala Deliver.io")}</div>
            <div class="lhl-subtitle" data-ref="lobbySubtitle">${t("labels.lobbySubtitle", {}, "Publica o privada | Maximo 6 jugadores")}</div>
          </div>
          <div class="lhl-share-mount" data-ref="shareMount"></div>
          <div class="lhl-garage-toolbar">
            <div class="lhl-garage-side-action" data-ref="garageActionMount"></div>
          </div>
          <div class="lhl-lobby-stage">
            <div class="lhl-garage-side" data-ref="garageSpotlight"></div>
            <div class="lhl-players-panel" data-ref="playersPanel"></div>
          </div>
          <div class="lhl-message" data-ref="lobbyMessage"></div>
          <div class="lhl-entry-mount" data-ref="entryMount"></div>
          <div class="lhl-actions-mount" data-ref="actionsMount"></div>
        </div>
      </div>
    `;
    appRoot.appendChild(this.lobbyRoot);

    const query = (ref) => this.lobbyRoot.querySelector(`[data-ref="${ref}"]`);
    const lobbyCardNode = query("lobbyCard");
    const titleNode = query("lobbyTitle");
    const subtitleNode = query("lobbySubtitle");
    const playersPanelNode = query("playersPanel");
    const messageNode = query("lobbyMessage");
    this.lobbyCardNode = lobbyCardNode;
    this.lobbyShareMount = query("shareMount");
    this.lobbyEntryMount = query("entryMount");
    this.lobbyActionsMount = query("actionsMount");
    this.lobbyGarageActionMount = query("garageActionMount");
    this.lobbyGarageSpotlightNode = query("garageSpotlight");
    this.lobbyPlayersPanelNode = playersPanelNode;
    this.lobbyMotoAmbientController = new LobbyMotoAmbientController(this.lobbyRoot);
    this.createAudioToggleUi();

    const renderPlayersPanel = (rawValue) => {
      if (!playersPanelNode) return;
      playersPanelNode.innerHTML = "";

      const players = Array.isArray(this.currentLobbyState?.players)
        ? this.currentLobbyState.players
        : [];
      const hostId = this.currentLobbyState?.hostId || "";

      if (players.length > 0) {
        players.forEach((player, index) => {
          const row = document.createElement("div");
          row.className = "lhl-player-row";
          let badgeCount = 0;
          const appendBadge = (badge) => {
            if (badgeCount === 0) {
              badge.classList.add("lhl-player-badge--offset");
            }
            badgeCount += 1;
            row.appendChild(badge);
          };

          const number = document.createElement("span");
          number.className = "lhl-player-index";
          number.textContent = `${index + 1}`;

          const name = document.createElement("span");
          name.className = "lhl-player-name";
          name.textContent = player?.name || "Jugador";

          row.appendChild(number);
          row.appendChild(name);

          if (player?.id === hostId) {
            const hostBadge = document.createElement("span");
            hostBadge.className = "lhl-player-badge";
            hostBadge.textContent = t("labels.host", {}, "Creador");
            appendBadge(hostBadge);
          }

          const readyBadge = document.createElement("span");
          readyBadge.className = player?.ready
            ? "lhl-player-badge lhl-player-badge--ready"
            : "lhl-player-badge lhl-player-badge--pending";
          readyBadge.textContent = player?.ready
            ? t("buttons.ready", {}, "Listo")
            : t("labels.waiting", {}, "Esperando");
          appendBadge(readyBadge);

          if (player?.id === this.multiplayer?.selfId) {
            row.classList.add("lhl-player-row--self");
          }

          playersPanelNode.appendChild(row);
        });
        return;
      }

      const fallbackLines = normalizeTextValue(rawValue)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (!fallbackLines.length) {
        fallbackLines.push(t("labels.noPlayers", {}, "Sin jugadores"));
      }
      fallbackLines.forEach((line) => {
        const row = document.createElement("div");
        row.className = "lhl-player-row lhl-player-row--muted";
        row.textContent = line;
        playersPanelNode.appendChild(row);
      });
    };

    this.lobbyBackdrop = createDomPanelProxy(this.lobbyRoot, "block");
    this.lobbyCard = createDomPanelProxy(lobbyCardNode, "block");
    this.lobbyPlayersPanel = createDomPanelProxy(playersPanelNode, "block");
    this.lobbyTitle = createDomTextProxy(titleNode);
    this.lobbySubtitle = createDomTextProxy(subtitleNode);
    this.playersListText = createDomTextProxy(playersPanelNode, {
      setContent: (value) => renderPlayersPanel(value),
    });
    this.lobbyMessage = createDomTextProxy(messageNode);

    this.readyButtonNode = document.createElement("button");
    this.readyButtonNode.type = "button";
    this.readyButtonNode.className = "lhl-btn lhl-btn-ready";
    setLobbyButtonLabel(this.readyButtonNode, t("buttons.ready", {}, "Listo"));
    this.lobbyActionsMount?.appendChild(this.readyButtonNode);

    this.startButtonNode = document.createElement("button");
    this.startButtonNode.type = "button";
    this.startButtonNode.className = "lhl-btn lhl-btn-start";
    setLobbyButtonLabel(this.startButtonNode, t("buttons.start", {}, "Empezar"));
    this.lobbyActionsMount?.appendChild(this.startButtonNode);

    this.readyButtonRect = createDomButtonProxy(this.readyButtonNode);
    this.readyButtonLabel = createDomTextProxy(this.readyButtonNode);
    this.readyButtonRect.on("pointerdown", () => {
      const players = Array.isArray(this.currentLobbyState?.players)
        ? this.currentLobbyState.players
        : [];
      const localPlayer = players.find((player) => player.id === this.multiplayer?.selfId);
      const nextReady = !Boolean(localPlayer?.ready);
      this.multiplayer?.emitSetLobbyReady(nextReady);
    });

    this.startButtonRect = createDomButtonProxy(this.startButtonNode);
    this.startButtonLabel = createDomTextProxy(this.startButtonNode);
    this.startButtonRect.on("pointerdown", () => {
      const lobbyState = this.currentLobbyState || {};
      const isPrivateRoom = String(lobbyState.roomType || "") === "private";
      const isHost = lobbyState.hostId === this.multiplayer?.selfId;
      const countdownEndsAt = Number(lobbyState.lobbyCountdownEndsAt || 0);
      const countdownActive =
        !Boolean(lobbyState.started) && countdownEndsAt > Date.now();

      if (isPrivateRoom && isHost && countdownActive) {
        this.multiplayer?.emitCancelStartGame?.();
        return;
      }

      this.multiplayer?.emitStartGame(ACTIVE_MAP.getSpawnPoint());
    });

    this.playersListText.setText("");
    this.lobbyPlayersPanel?.setVisible(false);
    this.lobbyMessage.setText("");
    this.readyButtonRect.disableInteractive();
    this.readyButtonRect.setVisible(false);
    this.readyButtonLabel.setVisible(false);
    this.startButtonRect.disableInteractive();
    this.startButtonRect.setVisible(false);
    this.startButtonLabel.setVisible(false);
  },

  destroyLobbyUi() {
    if (!this.lobbyRoot) return;
    this.destroyAudioToggleUi();
    this.lobbyMotoAmbientController?.destroy?.();
    this.lobbyMotoAmbientController = null;
    this.lobbyRoot.remove();
    this.lobbyRoot = null;
    this.lobbyCardNode = null;
    this.lobbyShareMount = null;
    this.lobbyEntryMount = null;
    this.lobbyActionsMount = null;
    this.lobbyGarageActionMount = null;
    this.lobbyGarageSpotlightNode = null;
    this.readyButtonNode = null;
    this.startButtonNode = null;
    this.garageQuickButton = null;
    this.lobbyBackdrop = null;
    this.lobbyCard = null;
    this.lobbyPlayersPanel = null;
    this.lobbyTitle = null;
    this.lobbySubtitle = null;
    this.playersListText = null;
    this.lobbyMessage = null;
    this.readyButtonRect = null;
    this.readyButtonLabel = null;
    this.startButtonRect = null;
    this.startButtonLabel = null;
  },

  createStatusBanner() {
    const { width } = this.scale.gameSize;
    this.statusBanner = this.add.text(width / 2, 60, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "34px",
      color: "#a7ffb8",
      fontStyle: "bold",
      stroke: "#102018",
      strokeThickness: 8,
    });
    this.statusBanner.setOrigin(0.5);
    this.statusBanner.setScrollFactor(0);
    this.statusBanner.setDepth(2100);
    this.statusBanner.setVisible(false);
    this.statusBanner.__isHudObject = true;
  },

  createWeatherUi() {
    const { width, height } = this.scale.gameSize;

    this.weatherOverlay = this.add.rectangle(
      0,
      0,
      width,
      height,
      0x6ea7ff,
      1
    );
    this.weatherOverlay.setOrigin(0);
    this.weatherOverlay.setScrollFactor(0);
    this.weatherOverlay.setDepth(2110);
    this.weatherOverlay.setAlpha(0);
    this.weatherOverlay.setVisible(false);

    if (this.textures.exists(RAIN_PARTICLE_TEXTURE_KEY)) {
      this.rainEmitter = this.add.particles(0, 0, RAIN_PARTICLE_TEXTURE_KEY, {
        emitting: false,
        frequency: 22,
        quantity: 2,
        lifespan: { min: 700, max: 1100 },
        speedY: { min: 760, max: 1220 },
        speedX: { min: -180, max: -90 },
        scale: { start: 0.22, end: 0.18 },
        alpha: { start: 0.8, end: 0.35 },
        blendMode: "NORMAL",
        x: {
          onEmit: () =>
            Math.random() * ((this.scale.gameSize?.width || width) + 120) - 60,
        },
        y: {
          onEmit: () => -Math.random() * 120 - 12,
        },
      });
      this.rainEmitter.setScrollFactor(0);
      this.rainEmitter.setDepth(2115);
      this.rainEmitter.setVisible(false);
      this.rainEmitter.__isHudObject = true;
    } else {
      this.rainEmitter = null;
    }
    this.rainEmitterActive = false;

    this.nightVisionOverlay = new NightVisionOverlay(this, {
      depth: 2120,
      blockedRatio:
        WEATHER_EVENT_CONFIG[WEATHER_EVENT_TYPES.NIGHT].nightVision?.blockedRatio ??
        0.35,
      color:
        WEATHER_EVENT_CONFIG[WEATHER_EVENT_TYPES.NIGHT].nightVision?.color ??
        0x000000,
      alpha:
        WEATHER_EVENT_CONFIG[WEATHER_EVENT_TYPES.NIGHT].nightVision?.alpha ?? 1,
    });
    this.nightVisionOverlay.resize(this.scale.gameSize);

    this.weatherEventText = this.add.text(width / 2, 108, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#d7e1ef",
      stroke: "#111822",
      strokeThickness: 6,
    });
    this.weatherEventText.setOrigin(0.5);
    this.weatherEventText.setScrollFactor(0);
    this.weatherEventText.setDepth(2140);
    this.weatherEventText.setVisible(false);
    this.weatherEventText.__isHudObject = true;

    this.weatherHintText = this.add.text(
      0,
      0,
      "Eventos: [1] lluvia  [2] asoleado  [3] noche  [4] limpiar  [5] tren",
      {
        fontFamily: "Consolas, monospace",
        fontSize: "18px",
        color: "#e7eef8",
      }
    );
    this.weatherHintText.setScrollFactor(0);
    this.weatherHintText.setDepth(2140);
    this.weatherHintText.setVisible(false);
    this.weatherHintText.__isHudObject = true;

    const buttonConfigs = [
      {
        type: WEATHER_EVENT_TYPES.RAIN,
        label: "Lluvia",
        keyLabel: "[1]",
        fillColor: 0x2f5f90,
      },
      {
        type: WEATHER_EVENT_TYPES.SUNNY,
        label: "Asoleado",
        keyLabel: "[2]",
        fillColor: 0x995c24,
      },
      {
        type: WEATHER_EVENT_TYPES.NIGHT,
        label: "Noche",
        keyLabel: "[3]",
        fillColor: 0x283047,
      },
      {
        type: WEATHER_EVENT_TYPES.NONE,
        label: "Quitar",
        keyLabel: "[4]",
        fillColor: 0x39424d,
        action: "clear",
      },
      {
        type: "train",
        label: "Tren",
        keyLabel: "[5]",
        fillColor: 0x6a2d2d,
        action: "train",
      },
    ];

    this.weatherButtons = buttonConfigs.map((config) => {
      const background = this.add.rectangle(0, 0, 156, 38, config.fillColor, 0.92);
      background.setOrigin(0, 0);
      background.setScrollFactor(0);
      background.setDepth(2140);
      background.setStrokeStyle(2, 0xffffff, 0.18);
      background.setVisible(false);
      background.setInteractive({ useHandCursor: true });
      background.on("pointerdown", () => {
        if (config.action === "clear" || config.type === WEATHER_EVENT_TYPES.NONE) {
          this.multiplayer?.emitClearWeatherEvent();
        } else if (config.action === "train") {
          this.multiplayer?.emitStartTrainEvent();
        } else {
          this.multiplayer?.emitQueueWeatherEvent(config.type);
        }
      });
      background.__isHudObject = true;

      const label = this.add.text(0, 0, `${config.keyLabel} ${config.label}`, {
        fontFamily: "Consolas, monospace",
        fontSize: "18px",
        color: "#ffffff",
      });
      label.setOrigin(0.5);
      label.setScrollFactor(0);
      label.setDepth(2141);
      label.setVisible(false);
      label.__isHudObject = true;

      return {
        ...config,
        background,
        label,
      };
    });

    this.layoutWeatherUi(this.scale.gameSize);
    this.setRainEmitterActive(false);
    this.setWeatherControlsVisible(false);
  },

  layoutWeatherUi(gameSize) {
    if (this.weatherOverlay) {
      this.weatherOverlay.setSize(gameSize.width, gameSize.height);
    }
    this.nightVisionOverlay?.resize(gameSize);

    if (this.weatherEventText) {
      this.weatherEventText.setPosition(gameSize.width / 2, 108);
    }

    if (this.weatherHintText) {
      this.weatherHintText.setPosition(WEATHER_UI_MARGIN, gameSize.height - 128);
    }

    const startX = WEATHER_UI_MARGIN;
    const y = gameSize.height - 92;
    const gap = 12;
    let currentX = startX;

    this.weatherButtons.forEach((button) => {
      button.background.setPosition(currentX, y);
      button.label.setPosition(currentX + 78, y + 19);
      currentX += button.background.width + gap;
    });
  },

  setWeatherControlsVisible(visible) {
    if (this.usingGameplayHudKit) {
      this.weatherHintText?.setVisible(false);
      this.weatherButtons.forEach((button) => {
        button.background.setVisible(false);
        button.label.setVisible(false);
        button.background.disableInteractive();
      });
      this.weatherEventText?.setVisible(false);
      return;
    }
    const showControls = visible && this.isLocalHost();
    this.weatherHintText?.setVisible(showControls);
    this.weatherButtons.forEach((button) => {
      button.background.setVisible(showControls);
      button.label.setVisible(showControls);
      if (showControls) {
        button.background.setInteractive({ useHandCursor: true });
      } else {
        button.background.disableInteractive();
      }
    });

    if (!visible) {
      this.weatherEventText?.setVisible(false);
    } else {
      this.refreshWeatherUi();
    }
  },

  refreshWeatherUi() {
    if (this.usingGameplayHudKit) {
      this.weatherEventText?.setVisible(false);
      this.weatherHintText?.setVisible(false);
      this.weatherButtons.forEach((button) => {
        button.background.setVisible(false);
        button.label.setVisible(false);
        button.background.disableInteractive();
      });
      return;
    }
    const hasWeatherState = this.weatherEvent.type !== WEATHER_EVENT_TYPES.NONE;

    this.weatherButtons.forEach((button) => {
      const selected =
        button.action !== "clear" &&
        button.action !== "train" &&
        button.type === this.weatherEvent.type;
      button.background.setAlpha(selected ? 1 : 0.88);
      button.background.setStrokeStyle(
        selected ? 3 : 2,
        selected ? 0xffffff : 0xffffff,
        selected ? 0.42 : 0.18
      );
      button.label.setAlpha(selected ? 1 : 0.9);
    });

    if (!this.weatherEventText) return;

    if (!hasWeatherState || !this.matchRunning) {
      this.weatherEventText.setVisible(false);
      return;
    }

    const now = Date.now();
    if (this.weatherEvent.phase === "countdown") {
      const remainingMs = Math.max(0, this.weatherEvent.startsAtMs - now);
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      this.weatherEventText.setText(
        `${this.weatherEvent.label} en ${remainingSeconds}`
      );
    } else {
      const remainingMs = Math.max(0, this.weatherEvent.endsAtMs - now);
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      this.weatherEventText.setText(
        `${this.weatherEvent.label} activa | ${remainingSeconds}s`
      );
    }
    this.weatherEventText.setColor(this.weatherEvent.accentColor);
    this.weatherEventText.setVisible(true);
  },

  setRainEmitterActive(active) {
    const shouldEmit = Boolean(active) && Boolean(this.rainEmitter);
    if (!this.rainEmitter) {
      this.rainEmitterActive = false;
      return;
    }
    if (this.rainEmitterActive === shouldEmit) return;

    this.rainEmitterActive = shouldEmit;
    this.rainEmitter.setVisible(shouldEmit);
    if (shouldEmit) {
      this.rainEmitter.start();
    } else {
      this.rainEmitter.stop(true);
    }
  },

  destroyWeatherUi() {
    this.setRainEmitterActive(false);
    this.rainEmitter?.destroy();
    this.rainEmitter = null;
    this.rainEmitterActive = false;
    this.weatherOverlay?.destroy();
    this.weatherOverlay = null;
    this.nightVisionOverlay?.destroy();
    this.nightVisionOverlay = null;
    this.weatherEventText?.destroy();
    this.weatherEventText = null;
    this.weatherHintText?.destroy();
    this.weatherHintText = null;
    this.weatherButtons.forEach((button) => {
      button.background.destroy();
      button.label.destroy();
    });
    this.weatherButtons = [];
  },

  createPositiveStockUi() {
    this.stockPanel = new PositiveStockPanel(this, {
      depth: 2140,
      margin: WEATHER_UI_MARGIN,
      onGrantTurbo: () => {
        if (!this.matchRunning || !this.isLocalHost()) return;
        if (!this.positiveStockSystem?.grantDebugTurbo()) return;
        this.refreshPositiveStockUi();
        this.statusBanner.setText("Turbo de test agregado");
        this.statusBanner.setColor("#9cf5b8");
        this.statusBanner.setVisible(true);
      },
    });
    this.stockPanel.setVisible(false);
    this.stockPanel.setHostControlsVisible(false);
  },

  destroyPositiveStockUi() {
    this.stockPanel?.destroy();
    this.stockPanel = null;
  },

  setPositiveStockUiVisible(visible) {
    if (this.usingGameplayHudKit) {
      this.stockPanel?.setVisible(false);
      this.stockPanel?.setHostControlsVisible(false);
      return;
    }
    this.stockPanel?.setVisible(Boolean(visible));
    this.stockPanel?.setHostControlsVisible(Boolean(visible) && this.isLocalHost());
  },

  refreshPositiveStockUi() {
    this.stockPanel?.update(this.positiveStockSystem?.getHudState?.() || {});
    this.stockPanel?.setHostControlsVisible(this.matchRunning && this.isLocalHost());
  },

  createItemUi() {
    this.itemPanel = new ItemInventoryPanel(this, {
      depth: 2140,
      margin: WEATHER_UI_MARGIN,
      onGrantOil: () => {
        if (!this.matchRunning || !this.isLocalHost()) return;
        this.multiplayer?.emitGrantItem(ITEM_TYPES.OIL);
      },
      onGrantWall: () => {
        if (!this.matchRunning || !this.isLocalHost()) return;
        this.multiplayer?.emitGrantItem(ITEM_TYPES.WALL);
      },
      onGrantEmp: () => {
        if (!this.matchRunning || !this.isLocalHost()) return;
        this.multiplayer?.emitGrantItem(ITEM_TYPES.EMP);
      },
    });
    this.itemPanel.setInventory(this.itemInventoryState);
    this.itemPanel.setVisible(false);
  },

  destroyItemUi() {
    this.itemPanel?.destroy();
    this.itemPanel = null;
  },

  setItemUiVisible(visible) {
    if (this.usingGameplayHudKit) {
      this.itemPanel?.setVisible(false);
      this.itemPanel?.setHostControlsVisible(false);
      return;
    }
    this.itemPanel?.setVisible(Boolean(visible));
    this.itemPanel?.setHostControlsVisible(Boolean(visible) && this.isLocalHost());
  },

  refreshItemUi() {
    this.itemPanel?.setInventory(this.itemInventoryState);
    this.itemPanel?.setHostControlsVisible(this.matchRunning && this.isLocalHost());
  },
};
