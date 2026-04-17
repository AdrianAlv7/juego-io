function encodeLobbySource(fileName) {
  return encodeURI(`/assets/sound/music/lobby/music1/${fileName}`);
}

const LOBBY_MUSIC_PRESETS = Object.freeze({
  lobbyMusic1: Object.freeze({
    id: "lobbyMusic1",
    label: "Lobby Music 1",
    // Ganancia interna del preset. El slider global de musica sigue controlando todo.
    trackGain: 0.5,
    // Campo reservado para ajustar animaciones visuales por preset (ambient/lobby).
    visualProfile: Object.freeze({
      key: "lobby_ambient_v1",
    }),
    tracks: Object.freeze({
      intro: encodeLobbySource("intro.ogg"),
      "drop1-1": encodeLobbySource("drop1-1.ogg"),
      "drop1-2": encodeLobbySource("drop1-2.ogg"),
      "drop1-3": encodeLobbySource("drop1-3.ogg"),
      "drop1-4": encodeLobbySource("drop1-4.ogg"),
      "drop1-5 moto": encodeLobbySource("drop1-5 moto.ogg"),
      "drop1-6 moto": encodeLobbySource("drop1-6 moto.ogg"),
      "drop1-end": encodeLobbySource("drop1-end.ogg"),
      "antes dropinsano": encodeLobbySource("antes dropinsano.ogg"),
      intermedio: encodeLobbySource("intermedio.ogg"),
      "dropinsano1-1": encodeLobbySource("dropinsano1-1.ogg"),
      "dropinsano1-2": encodeLobbySource("dropinsano1-2.ogg"),
      "dropinsano1-end": encodeLobbySource("dropinsano1-end.ogg"),
      end: encodeLobbySource("end.ogg"),
    }),
    previewAliases: Object.freeze({
      start: "intro",
      drop1: "drop1-1",
      drop2: "drop1-4",
      dropInsano: "dropinsano1-1",
    }),
    sequence: Object.freeze({
      drop1EntryLabels: Object.freeze(["drop1-1", "drop1-2"]),
      drop1Ligaments: Object.freeze({
        "drop1-1": "drop1-4",
        "drop1-2": "drop1-3",
      }),
      drop1MotoLabels: Object.freeze(["drop1-5 moto", "drop1-6 moto"]),
      insanoPatterns: Object.freeze([
        Object.freeze(["dropinsano1-1"]),
        Object.freeze(["dropinsano1-2"]),
        Object.freeze(["dropinsano1-1", "dropinsano1-2"]),
      ]),
      drop1BlockOptions: Object.freeze([
        Object.freeze({ key: "entry-end", weight: 14 }),
        Object.freeze({ key: "entry-partner-end", weight: 24 }),
        Object.freeze({ key: "entry-moto-end", weight: 25 }),
        Object.freeze({ key: "entry-partner-moto-end", weight: 37 }),
      ]),
    }),
  }),
});

export const DEFAULT_LOBBY_MUSIC_PRESET_ID = "lobbyMusic1";

export function getLobbyMusicPreset(presetId = DEFAULT_LOBBY_MUSIC_PRESET_ID) {
  const normalized = String(presetId || "").trim();
  if (normalized && LOBBY_MUSIC_PRESETS[normalized]) {
    return LOBBY_MUSIC_PRESETS[normalized];
  }
  return LOBBY_MUSIC_PRESETS[DEFAULT_LOBBY_MUSIC_PRESET_ID];
}

export function getLobbyMusicPresetIds() {
  return Object.keys(LOBBY_MUSIC_PRESETS);
}
