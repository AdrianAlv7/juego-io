// Capa de interfaz del GameScene.
// Construye y actualiza UI de lobby, clima, inventario, stock positivo, debug de resultados y entrada de nombre.
import NightVisionOverlay from "../../events/weather/NightVisionOverlay.js";
import ItemInventoryPanel from "../../items/ItemInventoryPanel.js";
import PositiveStockPanel from "../../items/PositiveStockPanel.js";
import { ITEM_TYPES } from "../../items/catalog.js";
import {
  WEATHER_EVENT_CONFIG,
  WEATHER_EVENT_TYPES,
} from "../../events/weather/catalog.js";
import { ACTIVE_MAP } from "../../world/activeMap.js";
import { USERNAME_MAX_LENGTH, WEATHER_UI_MARGIN } from "./constants.js";

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
        mode: "public",
        busyLabel: "Buscando...",
      },
      {
        button: this.privateCreateButton,
        mode: "private_create",
        busyLabel: "Creando...",
      },
      {
        button: this.privateJoinButton,
        mode: "private_join",
        busyLabel: "Uniendo...",
      },
    ];

    if (this.nameInput) {
      this.nameInput.disabled = isBusy;
    }
    if (this.roomCodeInput) {
      this.roomCodeInput.disabled = isBusy;
    }

    buttonConfigs.forEach(({ button, mode, busyLabel }) => {
      if (!button) return;
      button.disabled = isBusy;
      button.textContent =
        isBusy && roomMode === mode
          ? busyLabel
          : button.dataset.defaultLabel || button.textContent;
    });
    this.syncKeyboardCaptureState();
  },

  setLobbyMessage(message, color = "#ffd27d") {
    this.lobbyMessage?.setText(message || "");
    this.lobbyMessage?.setColor(color);
  },

  async copyCurrentRoomCode() {
    const roomCode = this.currentLobbyState?.roomCode || "";
    if (!roomCode) return;

    try {
      await navigator.clipboard.writeText(roomCode);
      if (this.roomShareButton) {
        this.roomShareButton.textContent = "Codigo copiado";
      }
      this.setLobbyMessage(`Codigo ${roomCode} copiado al portapapeles.`, "#95f5c8");
      window.setTimeout(() => {
        if (this.roomShareButton) {
          this.roomShareButton.textContent = "Copiar codigo";
        }
      }, 1400);
    } catch (_error) {
      this.setLobbyMessage(
        `No se pudo copiar. Comparte este codigo manualmente: ${roomCode}`,
        "#ffcf88"
      );
    }
  },

  updateRoomShareUi() {
    if (!this.roomShareRoot) return;

    const roomCode = this.currentLobbyState?.roomCode || "";
    const isPrivateRoom =
      this.currentLobbyState?.roomType === "private" && Boolean(roomCode);
    const isHost = this.currentLobbyState?.hostId === this.multiplayer?.selfId;
    const showShareUi = Boolean(
      isPrivateRoom && this.isRegistered && !this.matchRunning
    );

    this.roomShareRoot.style.display = showShareUi ? "flex" : "none";
    if (!showShareUi) return;

    if (this.roomShareCodeValue) {
      this.roomShareCodeValue.textContent = roomCode;
    }
    if (this.roomShareLabel) {
      this.roomShareLabel.textContent = isHost
        ? "Comparte este codigo"
        : "Codigo de sala";
    }
    if (this.roomShareHint) {
      this.roomShareHint.textContent =
        isHost
          ? "Compartelo con tus amigos para que entren directo a tu sala privada."
          : "Guardalo o copialo si quieres invitar a alguien mas despues.";
    }
    if (this.roomShareButton) {
      this.roomShareButton.textContent = "Copiar codigo";
    }
  },

  isDomTextEntryActive() {
    if (typeof document === "undefined") return false;
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return false;
    return ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName);
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
    this.nameEntryRoot.style.position = "absolute";
    this.nameEntryRoot.style.left = "50%";
    this.nameEntryRoot.style.top = "74%";
    this.nameEntryRoot.style.transform = "translate(-50%, -50%)";
    this.nameEntryRoot.style.display = "flex";
    this.nameEntryRoot.style.flexDirection = "column";
    this.nameEntryRoot.style.alignItems = "center";
    this.nameEntryRoot.style.gap = "12px";
    this.nameEntryRoot.style.minWidth = "720px";
    this.nameEntryRoot.style.maxWidth = "860px";
    this.nameEntryRoot.style.padding = "18px 20px";
    this.nameEntryRoot.style.border = "1px solid rgba(167, 201, 255, 0.22)";
    this.nameEntryRoot.style.borderRadius = "18px";
    this.nameEntryRoot.style.background =
      "linear-gradient(180deg, rgba(12, 19, 30, 0.96) 0%, rgba(8, 14, 22, 0.96) 100%)";
    this.nameEntryRoot.style.boxShadow =
      "0 20px 48px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.05)";
    this.nameEntryRoot.style.zIndex = "3000";

    const inputsRow = document.createElement("div");
    inputsRow.style.display = "flex";
    inputsRow.style.gap = "10px";
    inputsRow.style.alignItems = "center";
    inputsRow.style.justifyContent = "center";
    inputsRow.style.flexWrap = "wrap";

    const inputGroupStyle = (wrapper) => {
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.gap = "6px";
      wrapper.style.minWidth = "0";
    };

    const createInputLabel = (text, color = "#b9c9da") => {
      const label = document.createElement("div");
      label.textContent = text;
      label.style.fontFamily = "Consolas, monospace";
      label.style.fontSize = "12px";
      label.style.letterSpacing = "0.08em";
      label.style.textTransform = "uppercase";
      label.style.color = color;
      return label;
    };

    const nameGroup = document.createElement("div");
    inputGroupStyle(nameGroup);
    const roomGroup = document.createElement("div");
    inputGroupStyle(roomGroup);
    const nameLabel = createInputLabel("Jugador", "#a7d8bd");
    const roomLabel = createInputLabel("Codigo privado", "#a6c8f7");

    this.nameInput = document.createElement("input");
    this.nameInput.type = "text";
    this.nameInput.maxLength = USERNAME_MAX_LENGTH;
    this.nameInput.placeholder = "Username corto";
    this.nameInput.style.width = "260px";
    this.nameInput.style.height = "44px";
    this.nameInput.style.padding = "0 12px";
    this.nameInput.style.border = "2px solid #90c5a6";
    this.nameInput.style.borderRadius = "8px";
    this.nameInput.style.background = "#10171f";
    this.nameInput.style.color = "#eef4fb";
    this.nameInput.style.fontFamily = "Consolas, monospace";
    this.nameInput.style.fontSize = "18px";
    this.nameInput.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";

    this.roomCodeInput = document.createElement("input");
    this.roomCodeInput.type = "text";
    this.roomCodeInput.maxLength = 8;
    this.roomCodeInput.placeholder = "Codigo privado";
    this.roomCodeInput.style.width = "220px";
    this.roomCodeInput.style.height = "44px";
    this.roomCodeInput.style.padding = "0 12px";
    this.roomCodeInput.style.border = "2px solid #9cb7d9";
    this.roomCodeInput.style.borderRadius = "8px";
    this.roomCodeInput.style.background = "#10171f";
    this.roomCodeInput.style.color = "#eef4fb";
    this.roomCodeInput.style.fontFamily = "Consolas, monospace";
    this.roomCodeInput.style.fontSize = "18px";
    this.roomCodeInput.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";

    const actionsRow = document.createElement("div");
    actionsRow.style.display = "flex";
    actionsRow.style.gap = "10px";
    actionsRow.style.alignItems = "center";
    actionsRow.style.justifyContent = "center";
    actionsRow.style.flexWrap = "wrap";

    const helperText = document.createElement("div");
    helperText.textContent =
      "Publica te empareja con randoms. En privada puedes crear con codigo opcional o unirte con uno.";
    helperText.style.maxWidth = "760px";
    helperText.style.fontFamily = "Consolas, monospace";
    helperText.style.fontSize = "13px";
    helperText.style.lineHeight = "1.45";
    helperText.style.textAlign = "center";
    helperText.style.color = "#c6d4e5";

    const helperCaption = document.createElement("div");
    helperCaption.textContent = "Entrar a una sala";
    helperCaption.style.fontFamily = "Consolas, monospace";
    helperCaption.style.fontSize = "13px";
    helperCaption.style.fontWeight = "700";
    helperCaption.style.letterSpacing = "0.08em";
    helperCaption.style.textTransform = "uppercase";
    helperCaption.style.color = "#ffcf88";

    const makeActionButton = (label, background, borderColor) => {
      const button = document.createElement("button");
      button.textContent = label;
      button.dataset.defaultLabel = label;
      button.style.height = "46px";
      button.style.padding = "0 18px";
      button.style.border = `2px solid ${borderColor}`;
      button.style.borderRadius = "10px";
      button.style.background = background;
      button.style.color = "#ffffff";
      button.style.fontFamily = "Consolas, monospace";
      button.style.fontSize = "16px";
      button.style.fontWeight = "700";
      button.style.cursor = "pointer";
      button.style.boxShadow = "0 8px 18px rgba(0,0,0,0.22)";
      button.style.transition = "transform 120ms ease, filter 120ms ease";
      button.addEventListener("mouseenter", () => {
        if (button.disabled) return;
        button.style.transform = "translateY(-1px)";
        button.style.filter = "brightness(1.06)";
      });
      button.addEventListener("mouseleave", () => {
        button.style.transform = "translateY(0)";
        button.style.filter = "none";
      });
      return button;
    };

    this.publicMatchButton = makeActionButton("Publica", "#1f5f46", "#90c5a6");
    this.privateCreateButton = makeActionButton(
      "Crear privada",
      "#274a7a",
      "#8ab8ff"
    );
    this.privateJoinButton = makeActionButton(
      "Unirme con codigo",
      "#7a4b12",
      "#ffd27d"
    );

    const submitPublic = () => this.submitNameEntry("public");
    const submitCreatePrivate = () => this.submitNameEntry("private_create");
    const submitJoinPrivate = () => this.submitNameEntry("private_join");

    this.publicMatchButton.addEventListener("click", submitPublic);
    this.privateCreateButton.addEventListener("click", submitCreatePrivate);
    this.privateJoinButton.addEventListener("click", submitJoinPrivate);

    bindDomInputNode(this, this.nameInput, { onEnter: submitPublic });
    bindDomInputNode(this, this.roomCodeInput, { onEnter: submitJoinPrivate });
    bindDomInputNode(this, this.publicMatchButton);
    bindDomInputNode(this, this.privateCreateButton);
    bindDomInputNode(this, this.privateJoinButton);

    this.roomCodeInput.addEventListener("input", () => this.getNormalizedRoomCode());

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(this.nameInput);
    roomGroup.appendChild(roomLabel);
    roomGroup.appendChild(this.roomCodeInput);

    inputsRow.appendChild(nameGroup);
    inputsRow.appendChild(roomGroup);
    actionsRow.appendChild(this.publicMatchButton);
    actionsRow.appendChild(this.privateCreateButton);
    actionsRow.appendChild(this.privateJoinButton);

    this.nameEntryRoot.appendChild(helperCaption);
    this.nameEntryRoot.appendChild(inputsRow);
    this.nameEntryRoot.appendChild(actionsRow);
    this.nameEntryRoot.appendChild(helperText);
    appRoot.appendChild(this.nameEntryRoot);
    this.nameInput.focus();
    this.syncKeyboardCaptureState();
  },

  submitNameEntry(roomMode = "public") {
    if (!this.multiplayer || this.isRegistered) return;
    const raw = this.nameInput?.value?.trim() || "";
    const safeName = (raw || "Jugador").slice(0, USERNAME_MAX_LENGTH);
    const roomCode = this.getNormalizedRoomCode();
    if (roomMode === "private_join" && !roomCode) {
      this.lobbyMessage.setText("Escribe un codigo para entrar a una sala privada.");
      this.lobbyMessage.setColor("#ffcf88");
      this.roomCodeInput?.focus();
      return;
    }

    this.pendingRoomMode = roomMode;
    window.localStorage.setItem("repartidor_player_name", safeName);

    this.blurNameEntry();
    this.nameInput.value = safeName;
    this.setNameEntryBusy(roomMode);
    this.setLobbyMessage(
      roomMode === "public"
        ? "Buscando sala publica..."
        : roomMode === "private_create"
          ? "Creando sala privada..."
          : "Uniendote a sala privada..."
    );

    this.multiplayer.start({
      name: safeName,
      roomMode,
      roomCode,
      preferredSpawn: ACTIVE_MAP.getSpawnPoint(),
    });
  },

  onSocketInit() {
    this.isRegistered = true;
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
    this.privateCreateButton?.blur?.();
    this.privateJoinButton?.blur?.();
    this.syncKeyboardCaptureState();
  },

  createLeaveRoomUi() {
    const appRoot = document.getElementById("app");
    if (!appRoot) return;

    this.leaveRoomRoot = document.createElement("div");
    this.leaveRoomRoot.style.position = "absolute";
    this.leaveRoomRoot.style.left = "24px";
    this.leaveRoomRoot.style.top = "24px";
    this.leaveRoomRoot.style.display = "none";
    this.leaveRoomRoot.style.zIndex = "3000";

    this.leaveRoomButton = document.createElement("button");
    this.leaveRoomButton.textContent = "Salir de sala";
    this.leaveRoomButton.style.height = "40px";
    this.leaveRoomButton.style.padding = "0 16px";
    this.leaveRoomButton.style.border = "1px solid #ffb08b";
    this.leaveRoomButton.style.borderRadius = "8px";
    this.leaveRoomButton.style.background = "#6b2f21";
    this.leaveRoomButton.style.color = "#ffffff";
    this.leaveRoomButton.style.fontFamily = "Consolas, monospace";
    this.leaveRoomButton.style.fontSize = "14px";
    this.leaveRoomButton.style.cursor = "pointer";
    this.leaveRoomButton.addEventListener("click", () => this.leaveCurrentRoom());
    bindDomInputNode(this, this.leaveRoomButton);

    this.leaveRoomRoot.appendChild(this.leaveRoomButton);
    appRoot.appendChild(this.leaveRoomRoot);
  },

  createRoomShareUi() {
    const appRoot = document.getElementById("app");
    if (!appRoot) return;

    this.roomShareRoot = document.createElement("div");
    this.roomShareRoot.style.position = "absolute";
    this.roomShareRoot.style.left = "50%";
    this.roomShareRoot.style.top = "188px";
    this.roomShareRoot.style.transform = "translateX(-50%)";
    this.roomShareRoot.style.display = "none";
    this.roomShareRoot.style.flexDirection = "column";
    this.roomShareRoot.style.alignItems = "center";
    this.roomShareRoot.style.gap = "8px";
    this.roomShareRoot.style.minWidth = "360px";
    this.roomShareRoot.style.maxWidth = "calc(100vw - 32px)";
    this.roomShareRoot.style.padding = "14px 18px";
    this.roomShareRoot.style.border = "1px solid rgba(255, 214, 138, 0.26)";
    this.roomShareRoot.style.borderRadius = "18px";
    this.roomShareRoot.style.background =
      "linear-gradient(180deg, rgba(18, 26, 38, 0.96) 0%, rgba(10, 16, 24, 0.96) 100%)";
    this.roomShareRoot.style.boxShadow =
      "0 20px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)";
    this.roomShareRoot.style.zIndex = "3010";

    this.roomShareLabel = document.createElement("div");
    this.roomShareLabel.textContent = "Codigo de sala";
    this.roomShareLabel.style.fontFamily = "Consolas, monospace";
    this.roomShareLabel.style.fontSize = "12px";
    this.roomShareLabel.style.fontWeight = "700";
    this.roomShareLabel.style.letterSpacing = "0.12em";
    this.roomShareLabel.style.textTransform = "uppercase";
    this.roomShareLabel.style.color = "#ffcf88";

    this.roomShareCodeValue = document.createElement("div");
    this.roomShareCodeValue.style.fontFamily = "Consolas, monospace";
    this.roomShareCodeValue.style.fontSize = "42px";
    this.roomShareCodeValue.style.fontWeight = "700";
    this.roomShareCodeValue.style.letterSpacing = "0.18em";
    this.roomShareCodeValue.style.color = "#ffffff";
    this.roomShareCodeValue.style.textAlign = "center";
    this.roomShareCodeValue.style.textShadow = "0 4px 18px rgba(0,0,0,0.3)";
    this.roomShareCodeValue.style.padding = "2px 12px";
    this.roomShareCodeValue.style.borderRadius = "12px";
    this.roomShareCodeValue.style.background = "rgba(255, 255, 255, 0.04)";

    this.roomShareHint = document.createElement("div");
    this.roomShareHint.style.maxWidth = "520px";
    this.roomShareHint.style.fontFamily = "Consolas, monospace";
    this.roomShareHint.style.fontSize = "13px";
    this.roomShareHint.style.lineHeight = "1.45";
    this.roomShareHint.style.textAlign = "center";
    this.roomShareHint.style.color = "#c9d5e4";

    this.roomShareButton = document.createElement("button");
    this.roomShareButton.textContent = "Copiar codigo";
    this.roomShareButton.style.height = "40px";
    this.roomShareButton.style.padding = "0 18px";
    this.roomShareButton.style.border = "1px solid #ffd27d";
    this.roomShareButton.style.borderRadius = "10px";
    this.roomShareButton.style.background = "#6d4512";
    this.roomShareButton.style.color = "#ffffff";
    this.roomShareButton.style.fontFamily = "Consolas, monospace";
    this.roomShareButton.style.fontSize = "14px";
    this.roomShareButton.style.fontWeight = "700";
    this.roomShareButton.style.cursor = "pointer";
    this.roomShareButton.style.boxShadow = "0 8px 18px rgba(0,0,0,0.22)";
    this.roomShareButton.addEventListener("click", () => this.copyCurrentRoomCode());
    bindDomInputNode(this, this.roomShareButton);

    this.roomShareRoot.appendChild(this.roomShareLabel);
    this.roomShareRoot.appendChild(this.roomShareCodeValue);
    this.roomShareRoot.appendChild(this.roomShareHint);
    this.roomShareRoot.appendChild(this.roomShareButton);
    appRoot.appendChild(this.roomShareRoot);
  },

  setLeaveRoomUiVisible(visible) {
    if (!this.leaveRoomRoot) return;
    const canShow = Boolean(visible && this.isRegistered && !this.matchRunning);
    this.leaveRoomRoot.style.display = canShow ? "block" : "none";
    this.syncKeyboardCaptureState();
  },

  leaveCurrentRoom() {
    if (!this.isRegistered) return;
    if (this.matchRunning && !this.matchEnded) return;

    this.multiplayer?.destroy();
    this.isRegistered = false;
    this.currentLobbyState = null;
    this.pendingRoomMode = "public";
    this.setLobbyVisible(true);
    this.setLeaveRoomUiVisible(false);
    this.setNameEntryBusy(null);
    this.updateRoomShareUi();

    if (this.nameEntryRoot) {
      this.nameEntryRoot.style.display = "flex";
    }
    if (this.nameInput) {
      this.nameInput.disabled = false;
      if (!this.nameInput.value) {
        this.nameInput.value =
          window.localStorage.getItem("repartidor_player_name") || "";
      }
    }
    if (this.roomCodeInput) {
      this.roomCodeInput.disabled = false;
    }

    this.lobbyTitle.setText("Sala Repartidor.io");
    this.lobbySubtitle.setText("Publica o privada | Maximo 4 jugadores");
    this.playersListText.setText(["Elige un modo para entrar a una sala"]);
    this.setLobbyMessage("Busca publica, crea privada o entra con codigo.");
    this.startButtonRect.setVisible(false);
    this.startButtonLabel.setVisible(false);
    this.nameInput?.focus();
    this.syncKeyboardCaptureState();
  },

  destroyNameEntryUi() {
    if (!this.nameEntryRoot) return;
    this.nameEntryRoot.remove();
    this.nameEntryRoot = null;
    this.nameInput = null;
    this.roomCodeInput = null;
    this.publicMatchButton = null;
    this.privateCreateButton = null;
    this.privateJoinButton = null;
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
    this.roomShareRoot.remove();
    this.roomShareRoot = null;
    this.roomShareLabel = null;
    this.roomShareCodeValue = null;
    this.roomShareHint = null;
    this.roomShareButton = null;
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
    this.lobbyReturnButton.textContent = "Regresar al lobby";
    this.lobbyReturnButton.style.height = "40px";
    this.lobbyReturnButton.style.padding = "0 18px";
    this.lobbyReturnButton.style.border = "1px solid #ffd27d";
    this.lobbyReturnButton.style.borderRadius = "8px";
    this.lobbyReturnButton.style.background = "#6d4512";
    this.lobbyReturnButton.style.color = "#ffffff";
    this.lobbyReturnButton.style.fontFamily = "Consolas, monospace";
    this.lobbyReturnButton.style.fontSize = "14px";
    this.lobbyReturnButton.style.cursor = "pointer";

    this.lobbyReturnButton.addEventListener("click", () =>
      this.requestLobbyReturn()
    );
    bindDomInputNode(this, this.lobbyReturnButton);

    this.lobbyReturnRoot.appendChild(this.lobbyReturnText);
    this.lobbyReturnRoot.appendChild(this.lobbyReturnButton);
    appRoot.appendChild(this.lobbyReturnRoot);
  },

  updateLobbyReturnUi() {
    if (!this.lobbyReturnRoot || this.lobbyReturnRoot.style.display === "none") return;

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
    this.lobbyReturnRoot.style.display = visible ? "flex" : "none";
    if (visible) {
      this.updateLobbyReturnUi();
    }
    this.syncKeyboardCaptureState();
  },

  requestLobbyReturn() {
    if (!this.matchEnded) return;
    this.multiplayer?.emitRequestLobbyReturn();
    this.lobbyReturnText.textContent = "Regresando al lobby...";
  },

  destroyLobbyReturnUi() {
    if (!this.lobbyReturnRoot) return;
    this.lobbyReturnRoot.remove();
    this.lobbyReturnRoot = null;
    this.lobbyReturnText = null;
    this.lobbyReturnButton = null;
    this.syncKeyboardCaptureState();
  },

  createLobbyUi() {
    const { width, height } = this.scale.gameSize;

    this.lobbyBackdrop = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x0f141a,
      0.9
    );
    this.lobbyBackdrop.setScrollFactor(0);
    this.lobbyBackdrop.setDepth(2000);

    this.lobbyCard = this.add.rectangle(
      width / 2,
      height / 2,
      Math.min(980, width - 80),
      Math.min(760, height - 100),
      0x111926,
      0.92
    );
    this.lobbyCard.setScrollFactor(0);
    this.lobbyCard.setDepth(2005);
    this.lobbyCard.setStrokeStyle(2, 0x2d425a, 0.95);

    this.lobbyPlayersPanel = this.add.rectangle(
      width / 2,
      height / 2 - 18,
      Math.min(860, width - 140),
      240,
      0x0b121c,
      0.9
    );
    this.lobbyPlayersPanel.setScrollFactor(0);
    this.lobbyPlayersPanel.setDepth(2006);
    this.lobbyPlayersPanel.setStrokeStyle(1, 0x223346, 0.9);

    this.lobbyTitle = this.add.text(width / 2, 142, "Sala Repartidor.io", {
      fontFamily: "Consolas, monospace",
      fontSize: "54px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    this.lobbyTitle.setOrigin(0.5);
    this.lobbyTitle.setScrollFactor(0);
    this.lobbyTitle.setDepth(2010);

    this.lobbySubtitle = this.add.text(width / 2, 204, "Esperando jugadores", {
      fontFamily: "Consolas, monospace",
      fontSize: "22px",
      color: "#b8c4d1",
    });
    this.lobbySubtitle.setOrigin(0.5);
    this.lobbySubtitle.setScrollFactor(0);
    this.lobbySubtitle.setDepth(2010);

    this.playersListText = this.add.text(width / 2, height / 2 - 116, "Conectando...", {
      fontFamily: "Consolas, monospace",
      fontSize: "24px",
      color: "#e8edf3",
      align: "center",
      lineSpacing: 10,
      wordWrap: { width: Math.min(760, width - 200) },
    });
    this.playersListText.setOrigin(0.5, 0);
    this.playersListText.setScrollFactor(0);
    this.playersListText.setDepth(2010);

    this.lobbyMessage = this.add.text(width / 2, height - 174, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "20px",
      color: "#ffd27d",
      align: "center",
      wordWrap: { width: Math.min(820, width - 140) },
    });
    this.lobbyMessage.setOrigin(0.5);
    this.lobbyMessage.setScrollFactor(0);
    this.lobbyMessage.setDepth(2010);

    this.startButtonRect = this.add.rectangle(
      width / 2,
      height - 104,
      320,
      74,
      0x2f7f5f,
      1
    );
    this.startButtonRect.setStrokeStyle(3, 0xa9ffd8, 0.9);
    this.startButtonRect.setInteractive({ useHandCursor: true });
    this.startButtonRect.setScrollFactor(0);
    this.startButtonRect.setDepth(2010);
    this.startButtonRect.on("pointerdown", () => {
      this.multiplayer?.emitStartGame(ACTIVE_MAP.getSpawnPoint());
    });

    this.startButtonLabel = this.add.text(width / 2, height - 104, "PLAY", {
      fontFamily: "Consolas, monospace",
      fontSize: "36px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    this.startButtonLabel.setOrigin(0.5);
    this.startButtonLabel.setScrollFactor(0);
    this.startButtonLabel.setDepth(2011);
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

  destroyWeatherUi() {
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
    this.itemPanel?.setVisible(Boolean(visible));
    this.itemPanel?.setHostControlsVisible(Boolean(visible) && this.isLocalHost());
  },

  refreshItemUi() {
    this.itemPanel?.setInventory(this.itemInventoryState);
    this.itemPanel?.setHostControlsVisible(this.matchRunning && this.isLocalHost());
  },
};
