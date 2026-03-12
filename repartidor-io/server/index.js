import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  ITEM_CONFIG,
  ITEM_MAX_PER_PLAYER,
  ITEM_TYPES,
  buildDroppedItemPayload,
  createInventoryState,
  isItemType,
} from "../src/items/catalog.js";
import { ROUTE_REWARD_ITEM_POOL } from "../src/items/groups.js";
import { ROUTE_REWARD_KEYS } from "../src/items/RouteRewardSystem.js";

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 4;
const SPAWN_GAP = 90;
const SPAWN_COLUMNS = 1;
const MATCH_PRESTART_MS = 3000;
const FINISH_WINDOW_MS = 20000;
const LOBBY_RETURN_DELAY_MS = 20000;
const DEBUG_FINALIZE_GRACE_MS = 120;
const WEATHER_EVENT_WARNING_MS = 5000;
const WEATHER_EVENT_CONFIG = {
  rain: {
    type: "rain",
    label: "Lluvia",
    durationMs: 12000,
  },
  sunny: {
    type: "sunny",
    label: "Asoleado",
    durationMs: 12000,
  },
  night: {
    type: "night",
    label: "Noche",
    durationMs: 13000,
  },
};
const WEATHER_EVENT_TYPES = Object.keys(WEATHER_EVENT_CONFIG);
const WEATHER_RANDOM_COUNT_WEIGHTS = [
  { count: 0, weight: 0.08 },
  { count: 1, weight: 0.22 },
  { count: 2, weight: 0.36 },
  { count: 3, weight: 0.34 },
];
const WEATHER_FIRST_QUEUE_DELAY_RANGE_MS = {
  min: 6000,
  max: 14000,
};
const WEATHER_GAP_DELAY_RANGE_MS = {
  min: 11000,
  max: 22000,
};
const TRAIN_EVENT_CONFIG = {
  marketStreet: {
    id: "marketStreet",
    label: "Tren en Mercado",
    durationMs: 20000,
  },
  riverCrossing: {
    id: "riverCrossing",
    label: "Tren en Cruce Rio",
    durationMs: 20000,
  },
  depotLane: {
    id: "depotLane",
    label: "Tren en Deposito",
    durationMs: 20000,
  },
};
const TRAIN_EVENT_IDS = Object.keys(TRAIN_EVENT_CONFIG);
const TRAIN_RANDOM_COUNT_WEIGHTS = [
  { count: 0, weight: 0.12 },
  { count: 1, weight: 0.5 },
  { count: 2, weight: 0.38 },
];
const TRAIN_FIRST_DELAY_RANGE_MS = {
  min: 10000,
  max: 22000,
};
const TRAIN_GAP_DELAY_RANGE_MS = {
  min: 18000,
  max: 32000,
};
// Calidad pesa mas, pero el lider conserva una ventaja corta que cae por segundos.
const RESULT_SCORE_CONFIG = {
  qualityWeight: 1.25,
  leaderTimeBonus: 24,
  timePenaltyPerSecond: 4,
};
const ROUTE_REWARD_ITEM_MILESTONES = new Set([
  ROUTE_REWARD_KEYS.R1_ITEM,
  ROUTE_REWARD_KEYS.E2_ITEM,
  ROUTE_REWARD_KEYS.R3_ITEM,
]);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Estado unico de sala (version inicial para pruebas LAN).
const room = {
  players: new Map(),
  hostId: null,
  started: false,
  finished: false,
  baseSpawn: null,
  matchStartedAtMs: 0,
  finishReports: new Map(),
  finishWindowEndsAtMs: 0,
  finishWindowTimer: null,
  lobbyResetAtMs: 0,
  lobbyResetTimer: null,
  weatherQueuedEvent: null,
  weatherActiveEvent: null,
  weatherRuntimeTimers: new Set(),
  weatherScheduleTimers: new Set(),
  trainActiveEvent: null,
  trainRuntimeTimers: new Set(),
  trainScheduleTimers: new Set(),
  items: new Map(),
  itemRuntimeTimers: new Set(),
  nextItemSeq: 1,
};

function toFiniteNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function sanitizeState(payload = {}, fallback = {}) {
  return {
    x: toFiniteNumber(payload.x, fallback.x ?? 0),
    y: toFiniteNumber(payload.y, fallback.y ?? 0),
    angle: toFiniteNumber(payload.angle, fallback.angle ?? 0),
  };
}

function sanitizeQualityPercent(value, fallback = 0) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function sanitizeElapsedMs(value, fallback = 0) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.round(raw));
}

function sanitizeElapsedSeconds(value, fallback = 0) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, raw);
}

function createEmptyProgressState() {
  return {
    objectiveIndex: 0,
    totalObjectives: 1,
    serviceProgress: 0,
    distanceToObjectivePx: 0,
    progressValue: 0,
    liveQualityPercent: 0,
  };
}

function sanitizeProgressPayload(payload = {}, fallback = {}) {
  return {
    objectiveIndex: Math.max(
      0,
      Math.round(toFiniteNumber(payload.objectiveIndex, fallback.objectiveIndex ?? 0))
    ),
    totalObjectives: Math.max(
      1,
      Math.round(toFiniteNumber(payload.totalObjectives, fallback.totalObjectives ?? 1))
    ),
    serviceProgress: Math.max(
      0,
      Math.min(1, toFiniteNumber(payload.serviceProgress, fallback.serviceProgress ?? 0))
    ),
    distanceToObjectivePx: Math.max(
      0,
      Math.round(
        toFiniteNumber(
          payload.distanceToObjectivePx,
          fallback.distanceToObjectivePx ?? 0
        )
      )
    ),
    progressValue: Math.max(
      0,
      Math.round(toFiniteNumber(payload.progressValue, fallback.progressValue ?? 0))
    ),
    liveQualityPercent: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          toFiniteNumber(payload.liveQualityPercent, fallback.liveQualityPercent ?? 0)
        )
      )
    ),
  };
}

function randomInt(min, max) {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function trackTimer(timerSet, timer) {
  timerSet.add(timer);
  return timer;
}

function clearTimerSet(timerSet) {
  for (const timer of timerSet) {
    clearTimeout(timer);
  }
  timerSet.clear();
}

function pickWeightedCount(weightEntries) {
  const totalWeight = weightEntries.reduce(
    (sum, entry) => sum + entry.weight,
    0
  );
  let cursor = Math.random() * totalWeight;

  for (const entry of weightEntries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.count;
  }

  return weightEntries[weightEntries.length - 1].count;
}

function pickRandomWeatherType() {
  return WEATHER_EVENT_TYPES[randomInt(0, WEATHER_EVENT_TYPES.length - 1)] || "rain";
}

function pickRandomTrainEventId() {
  return TRAIN_EVENT_IDS[randomInt(0, TRAIN_EVENT_IDS.length - 1)] || "marketStreet";
}

function pickRandomRouteRewardItem() {
  return (
    ROUTE_REWARD_ITEM_POOL[randomInt(0, ROUTE_REWARD_ITEM_POOL.length - 1)] ||
    ITEM_TYPES.OIL
  );
}

function getLobbyPlayers() {
  return Array.from(room.players.entries()).map(([id, player]) => ({
    id,
    name: player.name,
  }));
}

function emitLobbyState() {
  io.emit("lobbyState", {
    players: getLobbyPlayers(),
    hostId: room.hostId,
    started: room.started,
    finished: room.finished,
    lobbyResetAt: room.lobbyResetAtMs,
    maxPlayers: MAX_PLAYERS,
  });
}

function resetMatchState() {
  if (room.finishWindowTimer) {
    clearTimeout(room.finishWindowTimer);
    room.finishWindowTimer = null;
  }
  if (room.lobbyResetTimer) {
    clearTimeout(room.lobbyResetTimer);
    room.lobbyResetTimer = null;
  }
  room.started = false;
  room.finished = false;
  room.baseSpawn = null;
  room.matchStartedAtMs = 0;
  room.finishReports.clear();
  room.finishWindowEndsAtMs = 0;
  room.lobbyResetAtMs = 0;
  room.weatherQueuedEvent = null;
  room.weatherActiveEvent = null;
  clearTimerSet(room.weatherRuntimeTimers);
  clearTimerSet(room.weatherScheduleTimers);
  room.trainActiveEvent = null;
  clearTimerSet(room.trainRuntimeTimers);
  clearTimerSet(room.trainScheduleTimers);
  clearRoomItems();
  for (const player of room.players.values()) {
    player.state = { x: 0, y: 0, angle: 0 };
    player.progress = createEmptyProgressState();
    player.inventory = [];
    player.claimedRouteRewards = new Set();
  }
}

function ensureHost() {
  if (room.hostId && room.players.has(room.hostId)) return;
  room.hostId = room.players.size > 0 ? room.players.keys().next().value : null;
}

function buildSpawnState(index) {
  const column = index % SPAWN_COLUMNS;
  const row = Math.floor(index / SPAWN_COLUMNS);
  const x = room.baseSpawn.x + column * SPAWN_GAP;
  const y = room.baseSpawn.y + row * SPAWN_GAP;
  return {
    x,
    y,
    angle: room.baseSpawn.angle ?? 0,
  };
}

function buildPlayersPayload() {
  const result = {};
  for (const [id, player] of room.players.entries()) {
    result[id] = player.state;
  }
  return result;
}

function buildTrackItemsPayload() {
  return Array.from(room.items.values()).map((item) => ({ ...item }));
}

function emitTrackItemsSnapshot(target = io) {
  target.emit("trackItemsSnapshot", {
    items: buildTrackItemsPayload(),
  });
}

function emitInventoryState(playerId) {
  const player = room.players.get(playerId);
  if (!player) return;
  io.to(playerId).emit("inventoryState", {
    playerId,
    ...createInventoryState(player.inventory || []),
  });
}

function emitAllInventoryStates() {
  for (const playerId of room.players.keys()) {
    emitInventoryState(playerId);
  }
}

function makeTrackItemId() {
  const nextId = room.nextItemSeq;
  room.nextItemSeq += 1;
  return `track-item-${nextId}`;
}

function clearRoomItems() {
  room.items.clear();
  clearTimerSet(room.itemRuntimeTimers);
}

function removeTrackItem(id) {
  if (!id || !room.items.has(id)) return false;
  room.items.delete(id);
  io.emit("trackItemRemoved", { id });
  return true;
}

function scheduleTrackItemRemoval(id, delayMs) {
  const safeDelayMs = Math.max(0, Number(delayMs) || 0);
  const timer = setTimeout(() => {
    room.itemRuntimeTimers.delete(timer);
    removeTrackItem(id);
  }, safeDelayMs);
  trackTimer(room.itemRuntimeTimers, timer);
}

function grantInventoryItem(playerId, type) {
  const player = room.players.get(playerId);
  if (!player || !isItemType(type)) return false;

  const inventory = Array.isArray(player.inventory) ? player.inventory : [];
  if (inventory.length >= ITEM_MAX_PER_PLAYER) return false;

  inventory.push(type);
  player.inventory = inventory;
  emitInventoryState(playerId);
  return true;
}

function claimRouteReward(playerId, rewardKey) {
  const player = room.players.get(playerId);
  if (!player) return false;
  if (!ROUTE_REWARD_ITEM_MILESTONES.has(rewardKey)) return false;

  const claimed = player.claimedRouteRewards || new Set();
  if (claimed.has(rewardKey)) return false;

  claimed.add(rewardKey);
  player.claimedRouteRewards = claimed;
  return grantInventoryItem(playerId, pickRandomRouteRewardItem());
}

function dropInventoryItem(playerId) {
  const player = room.players.get(playerId);
  if (!player || !Array.isArray(player.inventory) || player.inventory.length <= 0) {
    return null;
  }

  const [type] = player.inventory.splice(0, 1);
  if (type === "emp") {
    const config = ITEM_CONFIG[type];
    const pulsePayload = {
      id: makeTrackItemId(),
      type,
      ownerId: playerId,
      x: Number(player.state.x || 0),
      y: Number(player.state.y || 0),
      radius: Number(config?.radius || 520),
      effectDurationMs: Number(config?.effectDurationMs || 5000),
      pulseVisualDurationMs: Number(config?.pulseVisualDurationMs || 560),
      color: Number(config?.draw?.color || 0x6cc6ff),
      ringColor: Number(config?.draw?.ringColor || 0xffffff),
      createdAt: Date.now(),
    };
    io.emit("empPulseStarted", pulsePayload);
    emitInventoryState(playerId);
    return pulsePayload;
  }

  if (type === ITEM_TYPES.SHIELD) {
    const activationPayload = {
      id: makeTrackItemId(),
      type,
      ownerId: playerId,
      createdAt: Date.now(),
    };
    io.to(playerId).emit("inventoryItemActivated", activationPayload);
    emitInventoryState(playerId);
    return activationPayload;
  }

  const payload = buildDroppedItemPayload(
    type,
    playerId,
    player.state,
    makeTrackItemId(),
    Date.now()
  );
  if (!payload) {
    emitInventoryState(playerId);
    return null;
  }

  room.items.set(payload.id, payload);
  io.emit("trackItemAdded", payload);
  emitInventoryState(playerId);
  return payload;
}

function triggerTrackItem(playerId, itemId, reportedType = "") {
  const player = room.players.get(playerId);
  const item = room.items.get(itemId);
  if (!player || !item) return false;
  if (item.ownerId === playerId) return false;
  if (reportedType && item.type !== reportedType) return false;

  if (item.type === "oil") {
    if (item.triggeredAt) return false;
    item.triggeredAt = Date.now();
    item.removesAt =
      item.triggeredAt + (ITEM_CONFIG[item.type]?.removalDelayMs || 1500);
    io.emit("trackItemUpdated", { ...item });
    scheduleTrackItemRemoval(item.id, item.removesAt - Date.now());
    return true;
  }

  if (item.type === "wall") {
    return removeTrackItem(item.id);
  }

  return false;
}

function buildTimeDeltaSeconds(elapsedMs, fastestMs) {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(fastestMs)) return 0;
  return Math.max(0, Math.round((elapsedMs - fastestMs) / 1000));
}

function scoreAndRankResults(results = [], timeCapMs = 0) {
  const finishers = results.filter((entry) => entry.didFinish);
  const fastestMs = finishers.length
    ? Math.min(...finishers.map((entry) => entry.elapsedMs))
    : Math.max(0, timeCapMs);

  const withScores = results.map((entry) => {
    const timeDeltaSeconds = entry.didFinish
      ? buildTimeDeltaSeconds(entry.elapsedMs, fastestMs)
      : null;
    const qualityScore = entry.didFinish
      ? Math.round(entry.qualityPercent * RESULT_SCORE_CONFIG.qualityWeight)
      : 0;
    const timeScore = entry.didFinish
      ? Math.max(
          0,
          RESULT_SCORE_CONFIG.leaderTimeBonus -
            timeDeltaSeconds * RESULT_SCORE_CONFIG.timePenaltyPerSecond
        )
      : 0;
    const score = entry.didFinish ? qualityScore + timeScore : 0;

    return {
      ...entry,
      timeDeltaSeconds,
      qualityScore,
      timeScore,
      score,
    };
  });

  return withScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.didFinish !== b.didFinish) return a.didFinish ? -1 : 1;
    if (!a.didFinish && !b.didFinish) {
      if (b.objectiveIndex !== a.objectiveIndex) {
        return b.objectiveIndex - a.objectiveIndex;
      }
      if (b.qualityPercent !== a.qualityPercent) {
        return b.qualityPercent - a.qualityPercent;
      }
      if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
      return a.name.localeCompare(b.name);
    }
    if (b.qualityPercent !== a.qualityPercent) {
      return b.qualityPercent - a.qualityPercent;
    }
    if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
    return a.name.localeCompare(b.name);
  });
}

function storeFinishReport(playerId, payload = {}, options = {}) {
  const { allowOverride = false } = options;
  if (!allowOverride && room.finishReports.has(playerId)) return null;

  const player = room.players.get(playerId);
  if (!player) return null;

  const report = {
    id: playerId,
    name: player.name,
    elapsedMs: sanitizeElapsedMs(payload.elapsedMs, getElapsedSinceStartMs()),
    qualityPercent: sanitizeQualityPercent(payload.qualityPercent, 0),
    didFinish: payload.didFinish !== false,
    ...sanitizeProgressPayload(payload.progress, player.progress),
  };

  room.finishReports.set(playerId, report);
  return report;
}

function restartLobbyForEveryone(reason = "manual") {
  resetMatchState();
  io.emit("lobbyRestarted", {
    reason,
    restartedAt: Date.now(),
  });
  emitLobbyState();
}

function scheduleLobbyReset() {
  if (room.lobbyResetTimer) {
    clearTimeout(room.lobbyResetTimer);
    room.lobbyResetTimer = null;
  }

  room.lobbyResetAtMs = Date.now() + LOBBY_RETURN_DELAY_MS;
  room.lobbyResetTimer = setTimeout(() => {
    room.lobbyResetTimer = null;
    restartLobbyForEveryone("auto");
  }, LOBBY_RETURN_DELAY_MS + 50);
}

function scheduleDebugFinalize(includeMissingPlayers = true) {
  setTimeout(() => {
    if (!room.started || room.finished) return;

    const currentReports = Array.from(room.finishReports.values());
    const timeCapMs = currentReports.length
      ? Math.max(...currentReports.map((entry) => entry.elapsedMs))
      : getElapsedSinceStartMs();
    finalizeMatchWithReports(timeCapMs, includeMissingPlayers);
  }, DEBUG_FINALIZE_GRACE_MS);
}

function finalizeMatchWithReports(timeCapMs, includeMissingPlayers = false) {
  if (!room.started || room.finished) return false;
  if (room.players.size === 0) return false;

  if (room.finishWindowTimer) {
    clearTimeout(room.finishWindowTimer);
    room.finishWindowTimer = null;
  }

  const safeTimeCapMs = sanitizeElapsedMs(timeCapMs, getElapsedSinceStartMs());
  const resultsById = new Map(room.finishReports);

  if (includeMissingPlayers) {
    for (const [id, player] of room.players.entries()) {
      if (resultsById.has(id)) continue;
      resultsById.set(id, {
        id,
        name: player.name,
        elapsedMs: safeTimeCapMs,
        qualityPercent: sanitizeQualityPercent(player.progress.liveQualityPercent, 0),
        didFinish: false,
        ...sanitizeProgressPayload(player.progress, createEmptyProgressState()),
      });
    }
  }

  const ranked = scoreAndRankResults(Array.from(resultsById.values()), safeTimeCapMs);
  room.finished = true;
  room.finishWindowEndsAtMs = 0;
  room.weatherQueuedEvent = null;
  room.weatherActiveEvent = null;
  clearTimerSet(room.weatherRuntimeTimers);
  clearTimerSet(room.weatherScheduleTimers);
  room.trainActiveEvent = null;
  clearTimerSet(room.trainRuntimeTimers);
  clearTimerSet(room.trainScheduleTimers);
  clearRoomItems();
  for (const player of room.players.values()) {
    player.inventory = [];
  }
  scheduleLobbyReset();
  emitTrackItemsSnapshot();
  emitAllInventoryStates();
  io.emit("matchFinished", {
    winnerId: ranked[0]?.id || null,
    results: ranked,
    finishedAt: Date.now(),
    lobbyResetAt: room.lobbyResetAtMs,
    lobbyResetDelayMs: LOBBY_RETURN_DELAY_MS,
    scoring: RESULT_SCORE_CONFIG,
  });
  emitLobbyState();
  return true;
}

function getElapsedSinceStartMs() {
  if (!room.matchStartedAtMs) return 0;
  return Math.max(0, Date.now() - room.matchStartedAtMs - MATCH_PRESTART_MS);
}

function emitWeatherEventQueued(eventPayload) {
  io.emit("weatherEventQueued", {
    ...eventPayload,
    warningMs: WEATHER_EVENT_WARNING_MS,
  });
}

function emitWeatherEventStarted(eventPayload) {
  io.emit("weatherEventStarted", eventPayload);
}

function emitWeatherEventEnded(eventPayload) {
  io.emit("weatherEventEnded", eventPayload);
}

function emitTrainEventStarted(eventPayload) {
  io.emit("trainEventStarted", eventPayload);
}

function emitTrainEventEnded(eventPayload) {
  io.emit("trainEventEnded", eventPayload);
}

function clearCurrentWeatherEvent(reason = "cleared") {
  const currentEvent = room.weatherActiveEvent || room.weatherQueuedEvent;
  if (!currentEvent) return false;

  clearTimerSet(room.weatherRuntimeTimers);
  room.weatherQueuedEvent = null;
  room.weatherActiveEvent = null;

  emitWeatherEventEnded({
    type: currentEvent.type,
    label: currentEvent.label,
    reason,
    endedAt: Date.now(),
  });
  return true;
}

function startQueuedWeatherEvent() {
  if (!room.started || room.finished) return false;
  if (!room.weatherQueuedEvent) return false;

  const queuedEvent = room.weatherQueuedEvent;
  const config = WEATHER_EVENT_CONFIG[queuedEvent.type];
  if (!config) {
    room.weatherQueuedEvent = null;
    return false;
  }

  room.weatherQueuedEvent = null;
  room.weatherActiveEvent = {
    type: queuedEvent.type,
    label: queuedEvent.label,
    source: queuedEvent.source,
    durationMs: config.durationMs,
    startedAt: Date.now(),
    endsAt: Date.now() + config.durationMs,
  };

  emitWeatherEventStarted(room.weatherActiveEvent);

  const endTimer = setTimeout(() => {
    room.weatherRuntimeTimers.delete(endTimer);
    clearCurrentWeatherEvent("completed");
  }, config.durationMs + 30);
  trackTimer(room.weatherRuntimeTimers, endTimer);
  return true;
}

function queueRoomWeatherEvent(type, source = "rng") {
  if (!room.started || room.finished) return false;
  if (room.weatherQueuedEvent || room.weatherActiveEvent) return false;

  const config = WEATHER_EVENT_CONFIG[type];
  if (!config) return false;

  room.weatherQueuedEvent = {
    type: config.type,
    label: config.label,
    source,
    queuedAt: Date.now(),
    startsAt: Date.now() + WEATHER_EVENT_WARNING_MS,
    durationMs: config.durationMs,
  };
  emitWeatherEventQueued(room.weatherQueuedEvent);

  const startTimer = setTimeout(() => {
    room.weatherRuntimeTimers.delete(startTimer);
    startQueuedWeatherEvent();
  }, WEATHER_EVENT_WARNING_MS);
  trackTimer(room.weatherRuntimeTimers, startTimer);
  return true;
}

function scheduleRandomWeatherEvents() {
  clearTimerSet(room.weatherScheduleTimers);
  if (!room.started || room.finished) return;

  const totalEvents = pickWeightedCount(WEATHER_RANDOM_COUNT_WEIGHTS);
  let nextQueueDelayMs = randomInt(
    WEATHER_FIRST_QUEUE_DELAY_RANGE_MS.min,
    WEATHER_FIRST_QUEUE_DELAY_RANGE_MS.max
  );

  for (let index = 0; index < totalEvents; index += 1) {
    const type = pickRandomWeatherType();
    const timer = setTimeout(() => {
      room.weatherScheduleTimers.delete(timer);
      queueRoomWeatherEvent(type, "rng");
    }, nextQueueDelayMs);
    trackTimer(room.weatherScheduleTimers, timer);

    nextQueueDelayMs +=
      WEATHER_EVENT_WARNING_MS +
      WEATHER_EVENT_CONFIG[type].durationMs +
      randomInt(WEATHER_GAP_DELAY_RANGE_MS.min, WEATHER_GAP_DELAY_RANGE_MS.max);
  }
}

function clearCurrentTrainEvent(reason = "completed") {
  const currentEvent = room.trainActiveEvent;
  if (!currentEvent) return false;

  clearTimerSet(room.trainRuntimeTimers);
  room.trainActiveEvent = null;
  emitTrainEventEnded({
    id: currentEvent.id,
    label: currentEvent.label,
    endedAt: Date.now(),
    reason,
  });
  return true;
}

function startTrainEvent(id, source = "rng") {
  if (!room.started || room.finished) return false;
  if (room.trainActiveEvent) return false;

  const config = TRAIN_EVENT_CONFIG[id];
  if (!config) return false;

  room.trainActiveEvent = {
    id: config.id,
    label: config.label,
    durationMs: config.durationMs,
    source,
    startedAt: Date.now(),
    endsAt: Date.now() + config.durationMs,
  };
  emitTrainEventStarted(room.trainActiveEvent);

  const timer = setTimeout(() => {
    room.trainRuntimeTimers.delete(timer);
    clearCurrentTrainEvent("completed");
  }, config.durationMs + 30);
  trackTimer(room.trainRuntimeTimers, timer);
  return true;
}

function scheduleRandomTrainEvents() {
  clearTimerSet(room.trainScheduleTimers);
  if (!room.started || room.finished) return;

  const totalEvents = pickWeightedCount(TRAIN_RANDOM_COUNT_WEIGHTS);
  let nextDelayMs = randomInt(
    TRAIN_FIRST_DELAY_RANGE_MS.min,
    TRAIN_FIRST_DELAY_RANGE_MS.max
  );

  for (let index = 0; index < totalEvents; index += 1) {
    const eventId = pickRandomTrainEventId();
    const timer = setTimeout(() => {
      room.trainScheduleTimers.delete(timer);
      startTrainEvent(eventId, "rng");
    }, nextDelayMs);
    trackTimer(room.trainScheduleTimers, timer);

    nextDelayMs +=
      TRAIN_EVENT_CONFIG[eventId].durationMs +
      randomInt(TRAIN_GAP_DELAY_RANGE_MS.min, TRAIN_GAP_DELAY_RANGE_MS.max);
  }
}

function maybeFinalizeMatch(reason = "all_finished") {
  if (!room.started || room.finished) return false;
  if (room.players.size === 0) return false;

  const everyoneFinished = room.finishReports.size >= room.players.size;
  const timeoutReached =
    reason === "timeout" ||
    (room.finishWindowEndsAtMs > 0 && Date.now() >= room.finishWindowEndsAtMs);

  if (!everyoneFinished && !timeoutReached) return false;

  const currentReports = Array.from(room.finishReports.values());
  const maxReportedElapsedMs = currentReports.length
    ? Math.max(...currentReports.map((entry) => entry.elapsedMs))
    : 0;
  const timeCapMs = timeoutReached
    ? Math.max(
        maxReportedElapsedMs,
        Math.max(
          0,
          room.finishWindowEndsAtMs - room.matchStartedAtMs - MATCH_PRESTART_MS
        )
      )
    : maxReportedElapsedMs || getElapsedSinceStartMs();
  return finalizeMatchWithReports(timeCapMs, timeoutReached);
}

function startFinishWindowIfNeeded(firstReport) {
  if (room.finishWindowEndsAtMs > 0) return;
  if (room.players.size <= 1) {
    maybeFinalizeMatch("all_finished");
    return;
  }

  room.finishWindowEndsAtMs = Date.now() + FINISH_WINDOW_MS;
  io.emit("finishWindowStarted", {
    leaderId: firstReport.id,
    leaderName: firstReport.name,
    startedAt: Date.now(),
    endsAt: room.finishWindowEndsAtMs,
    durationMs: FINISH_WINDOW_MS,
  });

  room.finishWindowTimer = setTimeout(() => {
    maybeFinalizeMatch("timeout");
  }, FINISH_WINDOW_MS + 50);
}

io.on("connection", (socket) => {
  socket.on("registerPlayer", (payload = {}) => {
    if (room.players.has(socket.id)) {
      socket.emit("initState", {
        selfId: socket.id,
        players: buildPlayersPayload(),
      });
      emitLobbyState();
      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      socket.emit("roomError", {
        code: "ROOM_FULL",
        message: "Sala llena (maximo 4 jugadores).",
      });
      return;
    }

    if (room.started) {
      socket.emit("roomError", {
        code: "ROOM_IN_PROGRESS",
        message: "La partida ya inicio. Espera reinicio de sala.",
      });
      return;
    }

    const number = room.players.size + 1;
    const name = typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim().slice(0, 18)
      : `Jugador ${number}`;

    room.players.set(socket.id, {
      name,
      state: { x: 0, y: 0, angle: 0 },
      progress: createEmptyProgressState(),
      inventory: [],
      claimedRouteRewards: new Set(),
    });

    ensureHost();
    socket.emit("initState", {
      selfId: socket.id,
      players: buildPlayersPayload(),
    });
    emitLobbyState();
  });

  socket.on("startGame", (payload = {}) => {
    if (socket.id !== room.hostId) return;
    if (room.started) return;
    if (room.players.size === 0) return;

    const preferredSpawn = sanitizeState(payload.preferredSpawn, {
      x: 600,
      y: 5200,
      angle: 0,
    });
    room.baseSpawn = preferredSpawn;

    let index = 0;
    for (const player of room.players.values()) {
      player.state = buildSpawnState(index);
      index += 1;
    }

    room.started = true;
    room.finished = false;
    room.matchStartedAtMs = Date.now();
    room.finishReports.clear();
    room.finishWindowEndsAtMs = 0;
    if (room.finishWindowTimer) {
      clearTimeout(room.finishWindowTimer);
      room.finishWindowTimer = null;
    }
    room.weatherQueuedEvent = null;
    room.weatherActiveEvent = null;
    clearTimerSet(room.weatherRuntimeTimers);
    clearTimerSet(room.weatherScheduleTimers);
    room.trainActiveEvent = null;
    clearTimerSet(room.trainRuntimeTimers);
    clearTimerSet(room.trainScheduleTimers);
    clearRoomItems();
    for (const player of room.players.values()) {
      player.inventory = [];
      player.progress = createEmptyProgressState();
      player.claimedRouteRewards = new Set();
    }

    io.emit("gameStarted", {
      startedAt: Date.now(),
      players: buildPlayersPayload(),
    });
    emitTrackItemsSnapshot();
    emitAllInventoryStates();
    scheduleRandomWeatherEvents();
    scheduleRandomTrainEvents();
    emitLobbyState();
  });

  socket.on("updatePosition", (payload = {}) => {
    if (!room.started || room.finished) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    const next = sanitizeState(payload, player.state);
    const nextProgress = sanitizeProgressPayload(payload.progress, player.progress);
    player.state = next;
    player.progress = nextProgress;

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      ...next,
    });
  });

  socket.on("finishMatch", (payload = {}) => {
    if (!room.started || room.finished) return;
    const report = storeFinishReport(socket.id, payload);
    if (!report) return;

    if (!payload.finalizeNow && room.finishReports.size === 1) {
      startFinishWindowIfNeeded(report);
    }

    maybeFinalizeMatch("all_finished");
  });

  socket.on("debugSetFinishReport", (payload = {}) => {
    if (socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;

    const requestedPlayerId =
      typeof payload.playerId === "string" ? payload.playerId.trim() : "";
    const targetPlayerId = requestedPlayerId || socket.id;
    if (!room.players.has(targetPlayerId)) return;

    const elapsedSeconds = sanitizeElapsedSeconds(
      payload.elapsedSeconds,
      getElapsedSinceStartMs() / 1000
    );
    const report = storeFinishReport(
      targetPlayerId,
      {
        elapsedMs: elapsedSeconds * 1000,
        qualityPercent: payload.qualityPercent,
        didFinish: true,
      },
      { allowOverride: true }
    );
    if (!report) return;

    if (!payload.finalizeNow && room.finishReports.size === 1) {
      startFinishWindowIfNeeded(report);
    }

    if (payload.finalizeNow) {
      scheduleDebugFinalize(true);
      return;
    }

    maybeFinalizeMatch("all_finished");
  });

  socket.on("debugFinalizeMatch", () => {
    if (socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;

    scheduleDebugFinalize(true);
  });

  socket.on("restartLobby", () => {
    if (socket.id !== room.hostId) return;
    restartLobbyForEveryone("host");
  });

  socket.on("requestLobbyReturn", () => {
    if (!room.players.has(socket.id)) return;
    if (!room.finished) return;
    restartLobbyForEveryone("player");
  });

  socket.on("queueWeatherEvent", (payload = {}) => {
    if (socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;
    const type =
      typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";
    queueRoomWeatherEvent(type, "host");
  });

  socket.on("clearWeatherEvent", () => {
    if (socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;
    clearCurrentWeatherEvent("host_clear");
  });

  socket.on("startTrainEvent", (payload = {}) => {
    if (socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;
    const requestedId =
      typeof payload.id === "string" ? payload.id.trim() : "";
    const nextId = TRAIN_EVENT_CONFIG[requestedId]
      ? requestedId
      : pickRandomTrainEventId();
    startTrainEvent(nextId, "host");
  });

  socket.on("grantItem", (payload = {}) => {
    if (socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;

    const type =
      typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";
    grantInventoryItem(socket.id, type);
  });

  socket.on("claimRouteReward", (payload = {}) => {
    if (!room.started || room.finished) return;
    const rewardKey =
      typeof payload.rewardKey === "string" ? payload.rewardKey.trim() : "";
    if (!rewardKey) return;
    claimRouteReward(socket.id, rewardKey);
  });

  socket.on("dropItem", () => {
    if (!room.started || room.finished) return;
    dropInventoryItem(socket.id);
  });

  socket.on("triggerTrackItem", (payload = {}) => {
    if (!room.started || room.finished) return;

    const id = typeof payload.id === "string" ? payload.id.trim() : "";
    const type =
      typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";
    if (!id) return;
    triggerTrackItem(socket.id, id, type);
  });

  socket.on("disconnect", () => {
    const hadPlayer = room.players.delete(socket.id);
    if (!hadPlayer) return;
    room.finishReports.delete(socket.id);

    ensureHost();
    socket.broadcast.emit("playerDisconnected", {
      id: socket.id,
    });

    if (room.players.size === 0) {
      room.hostId = null;
      resetMatchState();
      return;
    }

    if (room.finishReports.size === 0) {
      room.finishWindowEndsAtMs = 0;
      if (room.finishWindowTimer) {
        clearTimeout(room.finishWindowTimer);
        room.finishWindowTimer = null;
      }
      room.weatherQueuedEvent = null;
      room.weatherActiveEvent = null;
      clearTimerSet(room.weatherRuntimeTimers);
      clearTimerSet(room.weatherScheduleTimers);
      room.trainActiveEvent = null;
      clearTimerSet(room.trainRuntimeTimers);
      clearTimerSet(room.trainScheduleTimers);
      clearRoomItems();
    } else {
      maybeFinalizeMatch("all_finished");
    }
    emitLobbyState();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[socket-server] running on http://localhost:${PORT}`);
});
