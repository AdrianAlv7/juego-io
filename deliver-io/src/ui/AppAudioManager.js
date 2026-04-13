import GameMusicController from "./GameMusicController.js";
import LobbyMusicController from "./LobbyMusicController.js";
import UiSoundController from "./UiSoundController.js";

const SFX_VOLUME_STORAGE_KEY = "deliver_audio_sfx_volume";
const MUSIC_VOLUME_STORAGE_KEY = "deliver_audio_music_volume";
const SFX_MUTED_STORAGE_KEY = "deliver_audio_sfx_muted";
const MUSIC_MUTED_STORAGE_KEY = "deliver_audio_music_muted";
// Defaults visibles en Ajustes. La musica luego se rebaja un poco mas con trackGain en LobbyMusicController.
const DEFAULT_SFX_VOLUME = 0.75;
const DEFAULT_MUSIC_VOLUME = 0.75;

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function loadStoredVolume(storageKey, fallback) {
  if (typeof window === "undefined" || !window.localStorage) {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (rawValue == null) return fallback;

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? clamp01(parsed) : fallback;
}

function persistVolume(storageKey, value) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(storageKey, String(clamp01(value)));
}

function loadStoredMuted(storageKey, fallback = false) {
  if (typeof window === "undefined" || !window.localStorage) {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (rawValue == null) return fallback;
  return rawValue === "true";
}

function persistMuted(storageKey, value) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(storageKey, value ? "true" : "false");
}

class AppAudioManager {
  constructor() {
    this.root = null;
    this.uiSoundController = null;
    this.activeMusicContext = "lobby";
    this.musicTransitionTimerId = 0;
    this.lobbyTrackLabel = "Musica: esperando";
    this.gameTrackLabel = "Partida: esperando";
    this.lobbyTrackState = {
      primaryLabel: "",
      overlayLabel: "",
      primarySource: "",
      overlaySource: "",
    };
    this.lobbyTrackLabelListener = null;
    this.gameTrackLabelListener = null;
    this.lobbyTrackStateListener = null;
    this.handleLobbyTrackLabelChange = this.handleLobbyTrackLabelChange.bind(this);
    this.handleGameTrackLabelChange = this.handleGameTrackLabelChange.bind(this);
    this.handleLobbyTrackStateChange = this.handleLobbyTrackStateChange.bind(this);
    this.sfxVolume = loadStoredVolume(SFX_VOLUME_STORAGE_KEY, DEFAULT_SFX_VOLUME);
    this.musicVolume = loadStoredVolume(MUSIC_VOLUME_STORAGE_KEY, DEFAULT_MUSIC_VOLUME);
    this.sfxMuted = loadStoredMuted(SFX_MUTED_STORAGE_KEY, false);
    this.musicMuted = loadStoredMuted(MUSIC_MUTED_STORAGE_KEY, false);
    this.lobbyMusicController = new LobbyMusicController({
      masterVolume: this.musicMuted ? 0 : this.musicVolume,
      onTrackLabelChange: this.handleLobbyTrackLabelChange,
      onTrackStateChange: this.handleLobbyTrackStateChange,
    });
    this.gameMusicController = new GameMusicController({
      masterVolume: this.musicMuted ? 0 : this.musicVolume,
      onTrackLabelChange: this.handleGameTrackLabelChange,
    });

    this.handleUserUnlock = this.handleUserUnlock.bind(this);
    this.handleWindowActivityChange = this.handleWindowActivityChange.bind(this);
    this.unlockListenersAttached = false;
    this.activityListenersAttached = false;
  }

  initialize(root) {
    if (!root) return;

    const nextRoot = root;
    if (this.root === nextRoot && this.uiSoundController) {
      this.applySfxState();
      this.applyMusicState();
      this.attachUnlockListeners();
      this.attachActivityListeners();
      return;
    }

    this.uiSoundController?.destroy();
    this.root = nextRoot;
    this.uiSoundController = new UiSoundController(this.root, {
      masterVolume: this.sfxMuted ? 0 : this.sfxVolume,
    });
    this.applySfxState();
    this.applyMusicState();
    this.attachUnlockListeners();
    this.attachActivityListeners();
  }

  applySfxState() {
    this.uiSoundController?.setMasterVolume(this.sfxMuted ? 0 : this.sfxVolume);
  }

  getActiveMusicController() {
    return this.activeMusicContext === "game"
      ? this.gameMusicController
      : this.lobbyMusicController;
  }

  clearMusicTransitionTimer() {
    if (!this.musicTransitionTimerId) return;
    window.clearTimeout(this.musicTransitionTimerId);
    this.musicTransitionTimerId = 0;
  }

  scheduleMusicTransition(delayMs, callback) {
    this.clearMusicTransitionTimer();
    if (delayMs <= 0) {
      callback?.();
      return;
    }

    this.musicTransitionTimerId = window.setTimeout(() => {
      this.musicTransitionTimerId = 0;
      callback?.();
    }, delayMs);
  }

  applyMusicState() {
    const resolvedMusicVolume = this.musicMuted ? 0 : this.musicVolume;
    this.lobbyMusicController.setMasterVolume(resolvedMusicVolume);
    this.gameMusicController.setMasterVolume(resolvedMusicVolume);
    if (this.musicMuted) return;
    if (!this.isWindowPrimary()) return;
    const activeController = this.getActiveMusicController();
    if (!activeController?.resumePlayback?.()) {
      activeController?.ensurePlayback?.();
    }
  }

  attachUnlockListeners() {
    if (this.unlockListenersAttached || typeof window === "undefined") return;
    window.addEventListener("pointerdown", this.handleUserUnlock, true);
    window.addEventListener("keydown", this.handleUserUnlock, true);
    this.unlockListenersAttached = true;
  }

  isWindowPrimary() {
    if (typeof document === "undefined") return true;
    const isVisible = document.visibilityState !== "hidden";
    const isFocused = typeof document.hasFocus === "function" ? document.hasFocus() : true;
    return isVisible && isFocused;
  }

  attachActivityListeners() {
    if (
      this.activityListenersAttached ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }

    // Estos listeners hacen que el lobby reaccione al cambiar de pestana o ventana:
    // bajamos la musica al irse al fondo y la retomamos con fade al volver.
    document.addEventListener("visibilitychange", this.handleWindowActivityChange, true);
    window.addEventListener("focus", this.handleWindowActivityChange, true);
    window.addEventListener("blur", this.handleWindowActivityChange, true);
    this.activityListenersAttached = true;
    this.handleWindowActivityChange();
  }

  handleUserUnlock() {
    this.getActiveMusicController()?.ensurePlayback?.();
  }

  handleWindowActivityChange() {
    if (!this.isWindowPrimary()) {
      this.gameMusicController.suspendPlayback();
      this.lobbyMusicController.suspendPlayback();
      return;
    }

    if (this.musicMuted) return;
    const activeController = this.getActiveMusicController();
    if (!activeController?.resumePlayback?.()) {
      activeController?.ensurePlayback?.();
    }
  }

  handleLobbyTrackLabelChange(label) {
    this.lobbyTrackLabel = String(label || "Musica: silencio");
    this.lobbyTrackLabelListener?.(this.lobbyTrackLabel);
  }

  handleGameTrackLabelChange(label) {
    this.gameTrackLabel = String(label || "Partida: silencio");
    this.gameTrackLabelListener?.(this.gameTrackLabel);
  }

  handleLobbyTrackStateChange(state) {
    this.lobbyTrackState = {
      primaryLabel: String(state?.primaryLabel || ""),
      overlayLabel: String(state?.overlayLabel || ""),
      primarySource: String(state?.primarySource || ""),
      overlaySource: String(state?.overlaySource || ""),
    };
    this.lobbyTrackStateListener?.(this.lobbyTrackState);
  }

  destroy() {
    if (this.unlockListenersAttached && typeof window !== "undefined") {
      window.removeEventListener("pointerdown", this.handleUserUnlock, true);
      window.removeEventListener("keydown", this.handleUserUnlock, true);
      this.unlockListenersAttached = false;
    }

    if (
      this.activityListenersAttached &&
      typeof window !== "undefined" &&
      typeof document !== "undefined"
    ) {
      document.removeEventListener("visibilitychange", this.handleWindowActivityChange, true);
      window.removeEventListener("focus", this.handleWindowActivityChange, true);
      window.removeEventListener("blur", this.handleWindowActivityChange, true);
      this.activityListenersAttached = false;
    }

    this.clearMusicTransitionTimer();
    this.uiSoundController?.destroy();
    this.uiSoundController = null;
    this.root = null;
    this.gameMusicController.destroy();
    this.lobbyMusicController.destroy();
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  setSfxVolume(value) {
    this.sfxVolume = clamp01(value);
    persistVolume(SFX_VOLUME_STORAGE_KEY, this.sfxVolume);
    this.applySfxState();
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  setMusicVolume(value) {
    this.musicVolume = clamp01(value);
    persistVolume(MUSIC_VOLUME_STORAGE_KEY, this.musicVolume);
    this.applyMusicState();
  }

  getSfxMuted() {
    return this.sfxMuted;
  }

  setSfxMuted(value) {
    this.sfxMuted = Boolean(value);
    persistMuted(SFX_MUTED_STORAGE_KEY, this.sfxMuted);
    this.applySfxState();
  }

  toggleSfxMuted() {
    this.setSfxMuted(!this.sfxMuted);
    return this.sfxMuted;
  }

  getMusicMuted() {
    return this.musicMuted;
  }

  setMusicMuted(value) {
    this.musicMuted = Boolean(value);
    persistMuted(MUSIC_MUTED_STORAGE_KEY, this.musicMuted);
    this.applyMusicState();
  }

  toggleMusicMuted() {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  getLobbyTrackLabel() {
    return this.lobbyTrackLabel;
  }

  setLobbyTrackLabelListener(listener) {
    this.lobbyTrackLabelListener = typeof listener === "function" ? listener : null;
    this.lobbyTrackLabelListener?.(this.lobbyTrackLabel);
  }

  getLobbyTrackState() {
    return this.lobbyTrackState;
  }

  getGameTrackLabel() {
    return this.gameTrackLabel;
  }

  setGameTrackLabelListener(listener) {
    this.gameTrackLabelListener = typeof listener === "function" ? listener : null;
    this.gameTrackLabelListener?.(this.gameTrackLabel);
  }

  setLobbyTrackStateListener(listener) {
    this.lobbyTrackStateListener = typeof listener === "function" ? listener : null;
    this.lobbyTrackStateListener?.(this.lobbyTrackState);
  }

  enterLobby(options = {}) {
    const restartIntro = options.restartIntro !== false;
    const fadeOutMs = Math.max(0, Number(options.fadeOutMs ?? options.gameFadeOutMs ?? 240));
    const hadGameMusic = this.gameMusicController.isSessionActive();

    this.clearMusicTransitionTimer();
    this.activeMusicContext = "lobby";
    this.gameMusicController.stop({ fadeOutMs });

    const beginLobbyMusic = () => {
      if (this.activeMusicContext !== "lobby") return;
      this.lobbyMusicController.enterLobby({ restartIntro });
      this.handleWindowActivityChange();
    };

    this.scheduleMusicTransition(hadGameMusic ? fadeOutMs : 0, beginLobbyMusic);
  }

  restartLobbyMusic() {
    this.clearMusicTransitionTimer();
    this.activeMusicContext = "lobby";
    this.gameMusicController.stop({ fadeOutMs: 0 });
    this.lobbyMusicController.enterLobby({ restartIntro: true });
    this.handleWindowActivityChange();
  }

  previewLobbyTrack(label) {
    this.clearMusicTransitionTimer();
    this.activeMusicContext = "lobby";
    this.gameMusicController.stop({ fadeOutMs: 0 });
    const didStartPreview = this.lobbyMusicController.previewTrackByLabel(label);
    this.handleWindowActivityChange();
    return didStartPreview;
  }

  leaveLobby(options = {}) {
    this.lobbyMusicController.stop(options);
  }

  // Transicion principal lobby -> partida. Dejamos morir el lobby con fade
  // y arrancamos el match cuando termina ese mismo fade para no superponer temas.
  startGameMusic(options = {}) {
    const fadeOutMs = Math.max(0, Number(options.fadeOutMs ?? options.lobbyFadeOutMs ?? 620));
    const hadLobbyMusic = this.lobbyMusicController.isSessionActive();

    this.clearMusicTransitionTimer();
    this.activeMusicContext = "game";
    this.lobbyMusicController.stop({ fadeOutMs });
    this.gameMusicController.stop({ fadeOutMs: 0 });

    const beginGameMusic = () => {
      if (this.activeMusicContext !== "game") return;
      this.gameMusicController.startMatch();
      this.handleWindowActivityChange();
    };

    this.scheduleMusicTransition(hadLobbyMusic ? fadeOutMs : 0, beginGameMusic);
  }

  handleGameObjectiveCompleted(completed) {
    this.gameMusicController.handleObjectiveCompleted(completed);
  }

  handleGameObjectiveServiceStarted(started) {
    this.gameMusicController.handleObjectiveServiceStarted(started);
  }

  handleGameLocalFinish() {
    this.gameMusicController.handleLocalFinish();
  }

  stopGameMusic(options = {}) {
    this.clearMusicTransitionTimer();
    this.gameMusicController.stop(options);
    if (this.activeMusicContext === "game") {
      this.activeMusicContext = "lobby";
    }
  }
}

const appAudioManager = new AppAudioManager();

export default appAudioManager;
