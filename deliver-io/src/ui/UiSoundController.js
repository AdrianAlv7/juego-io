const DEFAULT_INTERACTIVE_SELECTOR = [
  "button",
  "input:not([type=\"hidden\"])",
  "select",
  "textarea",
  "[role=\"button\"]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(", ");

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function buildSequentialSoundSet(folder, baseName, variantCount) {
  return Array.from({ length: variantCount }, (_, index) => {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    return `/assets/sound/effects/keys/${folder}/${baseName}${suffix}.ogg`;
  });
}

const ENTER_KEY_SOUNDS = buildSequentialSoundSet("enter", "Enter", 5);
const BACKSPACE_KEY_SOUNDS = buildSequentialSoundSet("backspace", "Backspace", 5);
const SPACE_KEY_SOUNDS = buildSequentialSoundSet("space", "Space", 5);
const TYPE_KEY_SOUNDS = buildSequentialSoundSet("tecla", "teclas", 10);

function isTextEntryTarget(node) {
  if (!(node instanceof HTMLElement)) return false;

  if (node instanceof HTMLTextAreaElement) {
    return !node.disabled && !node.readOnly;
  }

  if (node instanceof HTMLInputElement) {
    if (node.disabled || node.readOnly) return false;
    return !NON_TEXT_INPUT_TYPES.has(String(node.type || "").toLowerCase());
  }

  return node.isContentEditable;
}

class UiSoundEffect {
  constructor(src, options = {}) {
    this.src = src;
    this.baseVolume = clamp01(options.volume ?? 1);
    this.masterVolume = clamp01(options.masterVolume ?? 1);
    this.maxVoices = Math.max(1, Number(options.maxVoices ?? 1));
    this.stealAfterMs = Math.max(0, Number(options.stealAfterMs ?? 0));
    this.pool = [this.createAudio()];
  }

  createAudio() {
    const audio = new Audio(this.src);
    audio.preload = "auto";
    this.applyVolume(audio);
    audio.load();
    return audio;
  }

  applyVolume(audio) {
    if (!audio) return;
    audio.volume = clamp01(this.baseVolume * this.masterVolume);
  }

  setMasterVolume(masterVolume) {
    this.masterVolume = clamp01(masterVolume);
    this.pool.forEach((audio) => this.applyVolume(audio));
  }

  findAvailableAudio(now = performance.now()) {
    const availableAudio = this.pool.find(
      (audio) => audio.paused || audio.ended || audio.currentTime === 0
    );
    if (availableAudio) return availableAudio;

    if (this.pool.length < this.maxVoices) {
      const audio = this.createAudio();
      this.pool.push(audio);
      return audio;
    }

    if (this.stealAfterMs > 0) {
      const oldestAudio = this.pool.reduce((oldest, audio) =>
        (audio._lastStartedAt ?? -Infinity) < (oldest._lastStartedAt ?? -Infinity)
          ? audio
          : oldest
      );
      if (now - (oldestAudio?._lastStartedAt ?? -Infinity) >= this.stealAfterMs) {
        return oldestAudio;
      }
    }

    return null;
  }

  play(now = performance.now()) {
    const audio = this.findAvailableAudio(now);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio._lastStartedAt = now;
    audio.play().catch(() => {});
  }
}

class UiSoundBank {
  constructor(sources, options = {}) {
    const normalizedSources = Array.isArray(sources) ? sources.filter(Boolean) : [];
    this.effects = normalizedSources.map(
      (src) =>
        new UiSoundEffect(src, {
          volume: options.volume ?? 1,
          maxVoices: options.maxVoices ?? 1,
          stealAfterMs: options.stealAfterMs ?? 0,
          masterVolume: options.masterVolume ?? 1,
        })
    );
    this.minIntervalMs = Math.max(0, Number(options.minIntervalMs ?? 0));
    this.lastPlayAtByValueKey = new Map();
    this.lastPlayAtByObjectKey = new WeakMap();
    this.lastIndexByValueKey = new Map();
    this.lastIndexByObjectKey = new WeakMap();
  }

  setMasterVolume(masterVolume) {
    this.effects.forEach((effect) => effect.setMasterVolume(masterVolume));
  }

  getLastPlayAt(key) {
    if (key && typeof key === "object") {
      return this.lastPlayAtByObjectKey.get(key) ?? -Infinity;
    }
    return this.lastPlayAtByValueKey.get(String(key ?? "__default__")) ?? -Infinity;
  }

  setLastPlayAt(key, now) {
    if (key && typeof key === "object") {
      this.lastPlayAtByObjectKey.set(key, now);
      return;
    }
    this.lastPlayAtByValueKey.set(String(key ?? "__default__"), now);
  }

  getLastIndex(key) {
    if (key && typeof key === "object") {
      return this.lastIndexByObjectKey.get(key) ?? -1;
    }
    return this.lastIndexByValueKey.get(String(key ?? "__default__")) ?? -1;
  }

  setLastIndex(key, index) {
    if (key && typeof key === "object") {
      this.lastIndexByObjectKey.set(key, index);
      return;
    }
    this.lastIndexByValueKey.set(String(key ?? "__default__"), index);
  }

  pickEffect(key) {
    const totalEffects = this.effects.length;
    if (totalEffects === 0) return null;
    if (totalEffects === 1) return this.effects[0];

    const previousIndex = this.getLastIndex(key);
    let nextIndex = Math.floor(Math.random() * totalEffects);
    if (nextIndex === previousIndex) {
      nextIndex =
        (nextIndex + 1 + Math.floor(Math.random() * (totalEffects - 1))) % totalEffects;
    }
    this.setLastIndex(key, nextIndex);
    return this.effects[nextIndex];
  }

  play(options = {}) {
    const now = Number(options.now ?? performance.now());
    const key = options.key ?? "__default__";
    if (now - this.getLastPlayAt(key) < this.minIntervalMs) return;

    const effect = this.pickEffect(key);
    if (!effect) return;

    this.setLastPlayAt(key, now);
    effect.play(now);
  }
}

export default class UiSoundController {
  constructor(root, options = {}) {
    this.root = root || null;
    this.masterVolume = clamp01(options.masterVolume ?? 1);
    this.interactiveSelector =
      options.interactiveSelector || DEFAULT_INTERACTIVE_SELECTOR;

    this.hoverSound = new UiSoundBank(
      [options.hoverSrc || "/assets/sound/effects/button/hover.ogg"],
      {
        volume: options.hoverVolume ?? 0.45,
        minIntervalMs: options.hoverMinIntervalMs ?? 12,
        maxVoices: options.hoverMaxVoices ?? 4,
        stealAfterMs: options.hoverStealAfterMs ?? 22,
        masterVolume: this.masterVolume,
      }
    );
    this.clickSound = new UiSoundBank(
      [options.clickSrc || "/assets/sound/effects/button/click.ogg"],
      {
        volume: options.clickVolume ?? 0.7,
        minIntervalMs: options.clickMinIntervalMs ?? 36,
        maxVoices: options.clickMaxVoices ?? 3,
        stealAfterMs: options.clickStealAfterMs ?? 28,
        masterVolume: this.masterVolume,
      }
    );
    this.enterKeySound = new UiSoundBank(
      options.enterKeySources || ENTER_KEY_SOUNDS,
      {
        volume: options.enterKeyVolume ?? 0.45,
        minIntervalMs: options.enterKeyMinIntervalMs ?? 18,
        maxVoices: options.enterKeyMaxVoices ?? 1,
        stealAfterMs: options.enterKeyStealAfterMs ?? 16,
        masterVolume: this.masterVolume,
      }
    );
    this.backspaceKeySound = new UiSoundBank(
      options.backspaceKeySources || BACKSPACE_KEY_SOUNDS,
      {
        volume: options.backspaceKeyVolume ?? 0.42,
        minIntervalMs: options.backspaceKeyMinIntervalMs ?? 18,
        maxVoices: options.backspaceKeyMaxVoices ?? 1,
        stealAfterMs: options.backspaceKeyStealAfterMs ?? 16,
        masterVolume: this.masterVolume,
      }
    );
    this.spaceKeySound = new UiSoundBank(
      options.spaceKeySources || SPACE_KEY_SOUNDS,
      {
        volume: options.spaceKeyVolume ?? 0.38,
        minIntervalMs: options.spaceKeyMinIntervalMs ?? 14,
        maxVoices: options.spaceKeyMaxVoices ?? 1,
        stealAfterMs: options.spaceKeyStealAfterMs ?? 14,
        masterVolume: this.masterVolume,
      }
    );
    this.typeKeySound = new UiSoundBank(
      options.typeKeySources || TYPE_KEY_SOUNDS,
      {
        volume: options.typeKeyVolume ?? 0.34,
        minIntervalMs: options.typeKeyMinIntervalMs ?? 10,
        maxVoices: options.typeKeyMaxVoices ?? 1,
        stealAfterMs: options.typeKeyStealAfterMs ?? 12,
        masterVolume: this.masterVolume,
      }
    );

    this.lastHoverTarget = null;

    this.handlePointerOver = this.handlePointerOver.bind(this);
    this.handlePointerOut = this.handlePointerOut.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.attach();
  }

  setMasterVolume(masterVolume) {
    this.masterVolume = clamp01(masterVolume);
    [
      this.hoverSound,
      this.clickSound,
      this.enterKeySound,
      this.backspaceKeySound,
      this.spaceKeySound,
      this.typeKeySound,
    ].forEach((bank) => bank?.setMasterVolume(this.masterVolume));
  }

  attach() {
    if (!this.root) return;
    this.root.addEventListener("pointerover", this.handlePointerOver, true);
    this.root.addEventListener("pointerout", this.handlePointerOut, true);
    this.root.addEventListener("click", this.handleClick, true);
    this.root.addEventListener("keydown", this.handleKeyDown, true);
  }

  destroy() {
    if (!this.root) return;
    this.root.removeEventListener("pointerover", this.handlePointerOver, true);
    this.root.removeEventListener("pointerout", this.handlePointerOut, true);
    this.root.removeEventListener("click", this.handleClick, true);
    this.root.removeEventListener("keydown", this.handleKeyDown, true);
    this.lastHoverTarget = null;
  }

  getInteractiveTarget(rawTarget) {
    const target =
      rawTarget instanceof Element ? rawTarget : rawTarget?.parentElement || null;
    if (!target) return null;

    const interactiveTarget = target.closest(this.interactiveSelector);
    if (!interactiveTarget || !this.root?.contains(interactiveTarget)) {
      return null;
    }

    if (interactiveTarget.closest("[data-ui-sound=\"off\"]")) {
      return null;
    }

    if (
      interactiveTarget.hasAttribute("disabled") ||
      interactiveTarget.getAttribute("aria-disabled") === "true"
    ) {
      return null;
    }

    return interactiveTarget;
  }

  getTypingTarget(rawTarget) {
    const target =
      rawTarget instanceof HTMLElement ? rawTarget : rawTarget?.parentElement || null;
    if (!target || !this.root?.contains(target)) return null;

    const typingTarget = target.closest(
      "input, textarea, [contenteditable=\"true\"], [contenteditable=\"plaintext-only\"]"
    );
    if (!typingTarget || !(typingTarget instanceof HTMLElement)) return null;
    if (!this.root.contains(typingTarget)) return null;
    if (typingTarget.closest("[data-ui-sound=\"off\"]")) return null;

    return isTextEntryTarget(typingTarget) ? typingTarget : null;
  }

  resolveTypingSound(event) {
    if (event.isComposing) return null;

    const key = String(event.key || "");
    if (!key) return null;

    if (key === "Enter") return this.enterKeySound;
    if (key === "Backspace" || key === "Delete") return this.backspaceKeySound;
    if (key === " " || key === "Spacebar") return this.spaceKeySound;

    const isAltGraph = event.getModifierState?.("AltGraph") || false;
    if (event.metaKey || (event.ctrlKey && !isAltGraph) || (event.altKey && !isAltGraph)) {
      return null;
    }

    if (key === "Dead" || key.length === 1) {
      return this.typeKeySound;
    }

    return null;
  }

  handlePointerOver(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;

    const target = this.getInteractiveTarget(event.target);
    if (!target) return;

    const relatedTarget = this.getInteractiveTarget(event.relatedTarget);
    if (target === relatedTarget || target === this.lastHoverTarget) {
      return;
    }

    this.lastHoverTarget = target;
    this.hoverSound.play({ key: target });
  }

  handlePointerOut(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;

    const target = this.getInteractiveTarget(event.target);
    if (!target || target !== this.lastHoverTarget) return;

    const relatedTarget = this.getInteractiveTarget(event.relatedTarget);
    if (target !== relatedTarget) {
      this.lastHoverTarget = null;
    }
  }

  handleClick(event) {
    const target = this.getInteractiveTarget(event.target);
    if (!target) return;
    this.clickSound.play({ key: "__click__" });
  }

  handleKeyDown(event) {
    const target = this.getTypingTarget(event.target);
    if (!target) return;

    const soundBank = this.resolveTypingSound(event);
    if (!soundBank) return;

    soundBank.play({ key: target });
  }
}
