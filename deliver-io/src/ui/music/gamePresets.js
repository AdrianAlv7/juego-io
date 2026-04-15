function encodeGameSource(fileName) {
  return encodeURI(`/assets/sound/game/${fileName}`);
}

const GAME_MUSIC_PRESETS = Object.freeze({
  gameMusic1: Object.freeze({
    id: "gameMusic1",
    label: "Game Music 1",
    // Ganancia interna del preset. El slider global de musica sigue controlando todo.
    trackGain: 0.5,
    // Campo reservado para efectos visuales/animaciones ligados al preset in-game.
    visualProfile: Object.freeze({
      key: "ingame_flow_v1",
    }),
    tracks: Object.freeze({
      start: encodeGameSource("start.ogg"),
      "drop1-1": encodeGameSource("drop1-1.ogg"),
      "drop1-2": encodeGameSource("drop1-2.ogg"),
      "drop1-3": encodeGameSource("drop1-3.ogg"),
      "drop1-4": encodeGameSource("drop1-4.ogg"),
      "drop1-final4": encodeGameSource("drop1-final4.ogg"),
      "drop1-final2loop": encodeGameSource("drop1-final2loop.ogg"),
      "drop1-final2": encodeGameSource("drop1-final2.ogg"),
      "antes-del-drop2": encodeGameSource("antes del drop2.ogg"),
      "drop2-1": encodeGameSource("drop2-1.ogg"),
      "drop2-2": encodeGameSource("drop2-2.ogg"),
      "drop2-3": encodeGameSource("drop2-3.ogg"),
      "drop2-4": encodeGameSource("drop2-4.ogg"),
      "drop2-5": encodeGameSource("drop2-5.ogg"),
      "drop2-6": encodeGameSource("drop2-6.ogg"),
      "drop2-7": encodeGameSource("drop2-7.ogg"),
      "antes-del-drop3-1": encodeGameSource("antes del drop3-1.ogg"),
      "antes-del-drop3-2": encodeGameSource("antes del drop3-2.ogg"),
      "antes-del-drop3-3": encodeGameSource("antes del drop3-3.ogg"),
      "loop-antes-del-drop3-1": encodeGameSource("loop antes del drop 3-1.ogg"),
      "loop-antes-del-drop3-2": encodeGameSource("loop antes del drop 3-2.ogg"),
      "inicio-drop3": encodeGameSource("inicio drop 3.ogg"),
      "drop3-1-1": encodeGameSource("drop3-1-1.ogg"),
      "drop3-1-2": encodeGameSource("drop3-1-2.ogg"),
      "drop3-2-1": encodeGameSource("drop3-2-1.ogg"),
      "drop3-2-2": encodeGameSource("drop3-2-2.ogg"),
      "drop3-3-1": encodeGameSource("drop3-3-1.ogg"),
      "drop3-3-2": encodeGameSource("drop3-3-2.ogg"),
      "drop3-4-1": encodeGameSource("drop3-4-1.ogg"),
      "drop3-4-2": encodeGameSource("drop3-4-2.ogg"),
      final: encodeGameSource("final.ogg"),
      chill1: encodeGameSource("chill1.ogg"),
      chill2: encodeGameSource("chill2.ogg"),
      subida1: encodeGameSource("subida1.ogg"),
      subida2: encodeGameSource("subida2.ogg"),
    }),
    sequence: Object.freeze({
      drop1MainLoop: Object.freeze(["drop1-1", "drop1-2", "drop1-3", "drop1-4"]),
      drop1WaitLoop: Object.freeze([
        "drop1-final4",
        "drop1-final2loop",
        "drop1-final2",
        "drop1-4",
      ]),
      drop1AdvanceBlockedLabels: Object.freeze(["drop1-final2loop"]),
      drop2Loop: Object.freeze([
        "drop2-1",
        "drop2-2",
        "drop2-3",
        "drop2-4",
        "drop2-5",
        "drop2-6",
        "drop2-7",
      ]),
      drop3Loop: Object.freeze([
        "drop3-1-1",
        "drop3-1-2",
        "drop3-2-1",
        "drop3-2-2",
        "drop3-3-1",
        "drop3-3-2",
        "drop3-4-1",
        "drop3-4-2",
      ]),
      beforeDrop3Chain: Object.freeze([
        "antes-del-drop3-1",
        "antes-del-drop3-2",
        "antes-del-drop3-3",
      ]),
      beforeDrop3WaitLoop: Object.freeze([
        "loop-antes-del-drop3-1",
        "loop-antes-del-drop3-2",
      ]),
      shortBeforeDrop3DistanceKmThreshold: 0.27,
    }),
    outro: Object.freeze({
      intro: "chill1",
      loop: "chill2",
      labels: Object.freeze(["chill1", "chill2"]),
    }),
    forcePostFinishFadeLeadMs: 3000,
  }),
});

export const DEFAULT_GAME_MUSIC_PRESET_ID = "gameMusic1";

export function getGameMusicPreset(presetId = DEFAULT_GAME_MUSIC_PRESET_ID) {
  const normalized = String(presetId || "").trim();
  if (normalized && GAME_MUSIC_PRESETS[normalized]) {
    return GAME_MUSIC_PRESETS[normalized];
  }
  return GAME_MUSIC_PRESETS[DEFAULT_GAME_MUSIC_PRESET_ID];
}

export function getGameMusicPresetIds() {
  return Object.keys(GAME_MUSIC_PRESETS);
}
