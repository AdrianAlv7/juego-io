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
const MAX_PLAYERS = 6;
const SPAWN_GAP = 90;
const SPAWN_COLUMNS = 1;
const MATCH_PRESTART_MS = 3000;
const FINISH_WINDOW_MS = 20000;
const LOBBY_RETURN_DELAY_MS = 20000;
const LOBBY_COUNTDOWN_DEFAULT_MS = 10000;
const LOBBY_COUNTDOWN_READY_MS = 3000;
const DEBUG_FINALIZE_GRACE_MS = 120;
const WEATHER_EVENT_WARNING_MS = 5000;
const ROOM_CODE_LENGTH = 6;
const ROOM_TYPE_PUBLIC = "public";
const ROOM_TYPE_PRIVATE = "private";
const REGISTER_ROOM_MODES = {
  PUBLIC: "public",
  PRIVATE_CREATE: "private_create",
  PRIVATE_JOIN: "private_join",
};
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
const RESULT_SCORE_CONFIG = {
  qualityMaxScore: 100,
  leaderTimeScore: 100,
  maxScore: 200,
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

const rooms = new Map();
const playerRoomIds = new Map();
let nextRoomSequence = 1;

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

function normalizeRoomCode(value = "") {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function makeRandomRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += alphabet[randomInt(0, alphabet.length - 1)];
  }
  return code;
}

function getRoomChannel(roomId) {
  return `room:${roomId}`;
}

function createRoomState({ type = ROOM_TYPE_PUBLIC, code = "" } = {}) {
  const normalizedCode = type === ROOM_TYPE_PRIVATE ? normalizeRoomCode(code) : "";
  return {
    id: `room-${nextRoomSequence++}`,
    type,
    code: normalizedCode,
    players: new Map(),
    hostId: null,
    preferredSpawn: null,
    started: false,
    finished: false,
    lobbyCountdownEndsAtMs: 0,
    lobbyCountdownDurationMs: 0,
    lobbyCountdownReason: "",
    lobbyCountdownRequestedById: null,
    lobbyCountdownTimer: null,
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
}

function createRoom(options = {}) {
  const room = createRoomState(options);
  rooms.set(room.id, room);
  return room;
}

function getRoomBySocketId(socketId) {
  const roomId = playerRoomIds.get(socketId);
  if (!roomId) return null;
  return rooms.get(roomId) || null;
}

function findRoomByCode(code = "") {
  const normalizedCode = normalizeRoomCode(code);
  if (!normalizedCode) return null;
  for (const room of rooms.values()) {
    if (room.type === ROOM_TYPE_PRIVATE && room.code === normalizedCode) {
      return room;
    }
  }
  return null;
}

function generateUniquePrivateCode(preferredCode = "") {
  const normalizedPreferredCode = normalizeRoomCode(preferredCode);
  if (normalizedPreferredCode && !findRoomByCode(normalizedPreferredCode)) {
    return normalizedPreferredCode;
  }

  let nextCode = makeRandomRoomCode();
  while (findRoomByCode(nextCode)) {
    nextCode = makeRandomRoomCode();
  }
  return nextCode;
}

function getOrCreatePublicRoom() {
  for (const room of rooms.values()) {
    if (
      room.type === ROOM_TYPE_PUBLIC &&
      !room.started &&
      room.players.size < MAX_PLAYERS
    ) {
      return room;
    }
  }

  return createRoom({ type: ROOM_TYPE_PUBLIC });
}

function getRoomMeta(room) {
  return {
    roomId: room.id,
    roomType: room.type,
    roomCode: room.code || "",
    roomLabel:
      room.type === ROOM_TYPE_PUBLIC
        ? "Sala publica"
        : `Sala privada ${room.code || ""}`.trim(),
    maxPlayers: MAX_PLAYERS,
  };
}

function emitToRoom(room, eventName, payload) {
  io.to(getRoomChannel(room.id)).emit(eventName, payload);
}

function getLobbyReadyCount(room) {
  let readyCount = 0;
  for (const player of room.players.values()) {
    if (player.ready) {
      readyCount += 1;
    }
  }
  return readyCount;
}

function isLobbyEveryoneReady(room) {
  if (room.players.size <= 0) return false;
  return getLobbyReadyCount(room) >= room.players.size;
}

function getLobbyPlayers(room) {
  return Array.from(room.players.entries()).map(([id, player]) => ({
    id,
    name: player.name,
    ready: Boolean(player.ready),
  }));
}

function emitLobbyState(room) {
  const readyCount = getLobbyReadyCount(room);
  const allReady = room.players.size > 0 && readyCount >= room.players.size;
  emitToRoom(room, "lobbyState", {
    roomId: room.id,
    roomType: room.type,
    roomCode: room.code || "",
    roomLabel:
      room.type === ROOM_TYPE_PUBLIC
        ? "Sala publica"
        : `Sala privada ${room.code || ""}`.trim(),
    players: getLobbyPlayers(room),
    hostId: room.hostId,
    started: room.started,
    finished: room.finished,
    readyCount,
    allReady,
    lobbyCountdownEndsAt: room.lobbyCountdownEndsAtMs,
    lobbyCountdownDurationMs: room.lobbyCountdownDurationMs,
    lobbyCountdownReason: room.lobbyCountdownReason,
    lobbyCountdownRequestedById: room.lobbyCountdownRequestedById,
    lobbyResetAt: room.lobbyResetAtMs,
    maxPlayers: MAX_PLAYERS,
  });
}

function ensureHost(room) {
  if (room.hostId && room.players.has(room.hostId)) return;
  room.hostId = room.players.size > 0 ? room.players.keys().next().value : null;
}

function clearLobbyCountdown(room) {
  let changed = false;
  if (room.lobbyCountdownTimer) {
    clearTimeout(room.lobbyCountdownTimer);
    room.lobbyCountdownTimer = null;
    changed = true;
  }
  if (
    room.lobbyCountdownEndsAtMs > 0 ||
    room.lobbyCountdownDurationMs > 0 ||
    room.lobbyCountdownReason ||
    room.lobbyCountdownRequestedById
  ) {
    room.lobbyCountdownEndsAtMs = 0;
    room.lobbyCountdownDurationMs = 0;
    room.lobbyCountdownReason = "";
    room.lobbyCountdownRequestedById = null;
    changed = true;
  }
  return changed;
}

function launchGame(room, preferredSpawn = null) {
  if (!room || room.started || room.players.size === 0) return false;

  clearLobbyCountdown(room);
  const fallbackSpawn = { x: 600, y: 5200, angle: 0 };
  const spawnSource = preferredSpawn || room.preferredSpawn || fallbackSpawn;
  const safeSpawn = sanitizeState(spawnSource, fallbackSpawn);
  room.preferredSpawn = safeSpawn;
  room.baseSpawn = safeSpawn;

  let index = 0;
  for (const player of room.players.values()) {
    player.state = buildSpawnState(room, index);
    player.ready = false;
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
  clearRoomItems(room);
  for (const player of room.players.values()) {
    player.inventory = [];
    player.progress = createEmptyProgressState();
    player.claimedRouteRewards = new Set();
  }

  emitToRoom(room, "gameStarted", {
    startedAt: Date.now(),
    players: buildPlayersPayload(room),
    ...getRoomMeta(room),
  });
  emitTrackItemsSnapshot(room);
  emitAllInventoryStates(room);
  scheduleRandomWeatherEvents(room);
  scheduleRandomTrainEvents(room);
  emitLobbyState(room);
  return true;
}

function scheduleLobbyCountdown(
  room,
  {
    durationMs = LOBBY_COUNTDOWN_DEFAULT_MS,
    reason = "",
    preferredSpawn = null,
    requestedById = null,
  } = {}
) {
  if (!room || room.started || room.players.size === 0) return false;

  const safeDurationMs = Math.max(1000, sanitizeElapsedMs(durationMs, 10000));
  clearLobbyCountdown(room);
  room.lobbyCountdownEndsAtMs = Date.now() + safeDurationMs;
  room.lobbyCountdownDurationMs = safeDurationMs;
  room.lobbyCountdownReason = String(reason || "").slice(0, 32);
  room.lobbyCountdownRequestedById =
    typeof requestedById === "string" ? requestedById : null;
  if (preferredSpawn) {
    room.preferredSpawn = sanitizeState(preferredSpawn, {
      x: 600,
      y: 5200,
      angle: 0,
    });
  }

  room.lobbyCountdownTimer = setTimeout(() => {
    room.lobbyCountdownTimer = null;
    if (!rooms.has(room.id)) return;
    if (room.started || room.players.size === 0) {
      clearLobbyCountdown(room);
      emitLobbyState(room);
      return;
    }
    if (room.type === ROOM_TYPE_PUBLIC && room.players.size < MAX_PLAYERS) {
      clearLobbyCountdown(room);
      emitLobbyState(room);
      return;
    }
    launchGame(room, room.preferredSpawn);
  }, safeDurationMs + 25);

  emitLobbyState(room);
  return true;
}

function refreshLobbyStartFlow(room) {
  if (!room || room.started || room.finished) return;

  if (room.players.size <= 0) {
    clearLobbyCountdown(room);
    return;
  }

  const everyoneReady = isLobbyEveryoneReady(room);
  const now = Date.now();
  const countdownActive =
    room.lobbyCountdownEndsAtMs > now && Boolean(room.lobbyCountdownTimer);

  if (room.type === ROOM_TYPE_PUBLIC) {
    if (room.players.size < MAX_PLAYERS) {
      if (clearLobbyCountdown(room)) {
        emitLobbyState(room);
      }
      return;
    }

    const targetDuration = everyoneReady
      ? LOBBY_COUNTDOWN_READY_MS
      : LOBBY_COUNTDOWN_DEFAULT_MS;
    if (!countdownActive) {
      scheduleLobbyCountdown(room, {
        durationMs: targetDuration,
        reason: everyoneReady ? "all_ready" : "public_full",
        requestedById: null,
      });
      return;
    }

    if (targetDuration !== room.lobbyCountdownDurationMs) {
      scheduleLobbyCountdown(room, {
        durationMs: targetDuration,
        reason: everyoneReady ? "all_ready" : "public_full",
        preferredSpawn: room.preferredSpawn,
        requestedById: room.lobbyCountdownRequestedById,
      });
    }
    return;
  }

  if (!countdownActive) {
    return;
  }

  if (
    room.lobbyCountdownRequestedById &&
    !room.players.has(room.lobbyCountdownRequestedById)
  ) {
    if (clearLobbyCountdown(room)) {
      emitLobbyState(room);
    }
    return;
  }

  const targetDuration = everyoneReady
    ? LOBBY_COUNTDOWN_READY_MS
    : LOBBY_COUNTDOWN_DEFAULT_MS;
  if (targetDuration !== room.lobbyCountdownDurationMs) {
    scheduleLobbyCountdown(room, {
      durationMs: targetDuration,
      reason: everyoneReady ? "all_ready" : "private_start",
      preferredSpawn: room.preferredSpawn,
      requestedById: room.lobbyCountdownRequestedById,
    });
  }
}

function buildSpawnState(room, index) {
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

function buildPlayersPayload(room) {
  const result = {};
  for (const [id, player] of room.players.entries()) {
    result[id] = player.state;
  }
  return result;
}

function buildTrackItemsPayload(room) {
  return Array.from(room.items.values()).map((item) => ({ ...item }));
}

function emitTrackItemsSnapshot(room, target = null) {
  const emitter = target || io.to(getRoomChannel(room.id));
  emitter.emit("trackItemsSnapshot", {
    items: buildTrackItemsPayload(room),
  });
}

function emitInventoryState(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) return;
  io.to(playerId).emit("inventoryState", {
    playerId,
    ...createInventoryState(player.inventory || []),
  });
}

function emitAllInventoryStates(room) {
  for (const playerId of room.players.keys()) {
    emitInventoryState(room, playerId);
  }
}

function makeTrackItemId(room) {
  const nextId = room.nextItemSeq;
  room.nextItemSeq += 1;
  return `track-item-${room.id}-${nextId}`;
}

function clearRoomItems(room) {
  room.items.clear();
  clearTimerSet(room.itemRuntimeTimers);
}

function removeTrackItem(room, id) {
  if (!id || !room.items.has(id)) return false;
  room.items.delete(id);
  emitToRoom(room, "trackItemRemoved", { id });
  return true;
}

function scheduleTrackItemRemoval(room, id, delayMs) {
  const safeDelayMs = Math.max(0, Number(delayMs) || 0);
  const timer = setTimeout(() => {
    room.itemRuntimeTimers.delete(timer);
    removeTrackItem(room, id);
  }, safeDelayMs);
  trackTimer(room.itemRuntimeTimers, timer);
}

function grantInventoryItem(room, playerId, type) {
  const player = room.players.get(playerId);
  if (!player || !isItemType(type)) return false;

  const inventory = Array.isArray(player.inventory) ? player.inventory : [];
  if (inventory.length >= ITEM_MAX_PER_PLAYER) return false;

  inventory.push(type);
  player.inventory = inventory;
  emitInventoryState(room, playerId);
  return true;
}

function claimRouteReward(room, playerId, rewardKey) {
  const player = room.players.get(playerId);
  if (!player) return false;
  if (!ROUTE_REWARD_ITEM_MILESTONES.has(rewardKey)) return false;

  const claimed = player.claimedRouteRewards || new Set();
  if (claimed.has(rewardKey)) return false;

  claimed.add(rewardKey);
  player.claimedRouteRewards = claimed;
  return grantInventoryItem(room, playerId, pickRandomRouteRewardItem());
}

function dropInventoryItem(room, playerId) {
  const player = room.players.get(playerId);
  if (!player || !Array.isArray(player.inventory) || player.inventory.length <= 0) {
    return null;
  }

  const [type] = player.inventory.splice(0, 1);
  if (type === ITEM_TYPES.EMP) {
    const config = ITEM_CONFIG[type];
    const pulsePayload = {
      id: makeTrackItemId(room),
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
    emitToRoom(room, "empPulseStarted", pulsePayload);
    emitInventoryState(room, playerId);
    return pulsePayload;
  }

  if (type === ITEM_TYPES.SHIELD) {
    const activationPayload = {
      id: makeTrackItemId(room),
      type,
      ownerId: playerId,
      createdAt: Date.now(),
    };
    io.to(playerId).emit("inventoryItemActivated", activationPayload);
    emitInventoryState(room, playerId);
    return activationPayload;
  }

  const payload = buildDroppedItemPayload(
    type,
    playerId,
    player.state,
    makeTrackItemId(room),
    Date.now()
  );
  if (!payload) {
    emitInventoryState(room, playerId);
    return null;
  }

  room.items.set(payload.id, payload);
  emitToRoom(room, "trackItemAdded", payload);
  emitInventoryState(room, playerId);
  return payload;
}

function triggerTrackItem(room, playerId, itemId, reportedType = "") {
  const player = room.players.get(playerId);
  const item = room.items.get(itemId);
  if (!player || !item) return false;
  if (item.ownerId === playerId) return false;
  if (reportedType && item.type !== reportedType) return false;

  if (item.type === ITEM_TYPES.OIL) {
    if (item.triggeredAt) return false;
    item.triggeredAt = Date.now();
    item.removesAt =
      item.triggeredAt + (ITEM_CONFIG[item.type]?.removalDelayMs || 1500);
    emitToRoom(room, "trackItemUpdated", { ...item });
    scheduleTrackItemRemoval(room, item.id, item.removesAt - Date.now());
    return true;
  }

  if (item.type === ITEM_TYPES.WALL) {
    return removeTrackItem(room, item.id);
  }

  return false;
}

function buildTimeDeltaSeconds(elapsedMs, fastestMs) {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(fastestMs)) return 0;
  return Math.max(0, Math.round((elapsedMs - fastestMs) / 1000));
}

function buildRelativeTimeScore(elapsedMs, fastestMs) {
  const safeFastestMs = Math.max(1, sanitizeElapsedMs(fastestMs, 1));
  const safeElapsedMs = Math.max(
    safeFastestMs,
    sanitizeElapsedMs(elapsedMs, safeFastestMs)
  );
  return Math.round(
    RESULT_SCORE_CONFIG.leaderTimeScore * (safeFastestMs / safeElapsedMs)
  );
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
      ? Math.round(
          (sanitizeQualityPercent(entry.qualityPercent, 0) / 100) *
            RESULT_SCORE_CONFIG.qualityMaxScore
        )
      : 0;
    const timeScore = entry.didFinish
      ? buildRelativeTimeScore(entry.elapsedMs, fastestMs)
      : 0;
    const score = entry.didFinish
      ? Math.min(RESULT_SCORE_CONFIG.maxScore, qualityScore + timeScore)
      : 0;

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

function getElapsedSinceStartMs(room) {
  if (!room.matchStartedAtMs) return 0;
  return Math.max(0, Date.now() - room.matchStartedAtMs - MATCH_PRESTART_MS);
}

function storeFinishReport(room, playerId, payload = {}, options = {}) {
  const { allowOverride = false } = options;
  if (!allowOverride && room.finishReports.has(playerId)) return null;

  const player = room.players.get(playerId);
  if (!player) return null;

  const report = {
    id: playerId,
    name: player.name,
    elapsedMs: sanitizeElapsedMs(payload.elapsedMs, getElapsedSinceStartMs(room)),
    qualityPercent: sanitizeQualityPercent(payload.qualityPercent, 0),
    didFinish: payload.didFinish !== false,
    ...sanitizeProgressPayload(payload.progress, player.progress),
  };

  room.finishReports.set(playerId, report);
  return report;
}
function resetMatchState(room) {
  if (room.finishWindowTimer) {
    clearTimeout(room.finishWindowTimer);
    room.finishWindowTimer = null;
  }
  if (room.lobbyResetTimer) {
    clearTimeout(room.lobbyResetTimer);
    room.lobbyResetTimer = null;
  }
  clearLobbyCountdown(room);
  room.started = false;
  room.finished = false;
  room.baseSpawn = null;
  room.preferredSpawn = null;
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
  clearRoomItems(room);
  for (const player of room.players.values()) {
    player.state = { x: 0, y: 0, angle: 0 };
    player.ready = false;
    player.progress = createEmptyProgressState();
    player.inventory = [];
    player.claimedRouteRewards = new Set();
  }
}

function destroyRoom(room) {
  resetMatchState(room);
  rooms.delete(room.id);
}

function restartLobbyForEveryone(room, reason = "manual") {
  resetMatchState(room);
  refreshLobbyStartFlow(room);
  emitToRoom(room, "lobbyRestarted", {
    reason,
    restartedAt: Date.now(),
    ...getRoomMeta(room),
  });
  emitLobbyState(room);
}

function scheduleLobbyReset(room) {
  if (room.lobbyResetTimer) {
    clearTimeout(room.lobbyResetTimer);
    room.lobbyResetTimer = null;
  }

  room.lobbyResetAtMs = Date.now() + LOBBY_RETURN_DELAY_MS;
  room.lobbyResetTimer = setTimeout(() => {
    room.lobbyResetTimer = null;
    if (!rooms.has(room.id)) return;
    restartLobbyForEveryone(room, "auto");
  }, LOBBY_RETURN_DELAY_MS + 50);
}

function scheduleDebugFinalize(room, includeMissingPlayers = true) {
  setTimeout(() => {
    if (!rooms.has(room.id)) return;
    if (!room.started || room.finished) return;

    const currentReports = Array.from(room.finishReports.values());
    const timeCapMs = currentReports.length
      ? Math.max(...currentReports.map((entry) => entry.elapsedMs))
      : getElapsedSinceStartMs(room);
    finalizeMatchWithReports(room, timeCapMs, includeMissingPlayers);
  }, DEBUG_FINALIZE_GRACE_MS);
}

function finalizeMatchWithReports(room, timeCapMs, includeMissingPlayers = false) {
  if (!room.started || room.finished) return false;
  if (room.players.size === 0) return false;

  if (room.finishWindowTimer) {
    clearTimeout(room.finishWindowTimer);
    room.finishWindowTimer = null;
  }

  const safeTimeCapMs = sanitizeElapsedMs(timeCapMs, getElapsedSinceStartMs(room));
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
  clearRoomItems(room);
  for (const player of room.players.values()) {
    player.inventory = [];
  }

  scheduleLobbyReset(room);
  emitTrackItemsSnapshot(room);
  emitAllInventoryStates(room);
  emitToRoom(room, "matchFinished", {
    winnerId: ranked[0]?.id || null,
    results: ranked,
    finishedAt: Date.now(),
    lobbyResetAt: room.lobbyResetAtMs,
    lobbyResetDelayMs: LOBBY_RETURN_DELAY_MS,
    scoring: RESULT_SCORE_CONFIG,
    ...getRoomMeta(room),
  });
  emitLobbyState(room);
  return true;
}

function emitWeatherEventQueued(room, eventPayload) {
  emitToRoom(room, "weatherEventQueued", {
    ...eventPayload,
    warningMs: WEATHER_EVENT_WARNING_MS,
  });
}

function emitWeatherEventStarted(room, eventPayload) {
  emitToRoom(room, "weatherEventStarted", eventPayload);
}

function emitWeatherEventEnded(room, eventPayload) {
  emitToRoom(room, "weatherEventEnded", eventPayload);
}

function emitTrainEventStarted(room, eventPayload) {
  emitToRoom(room, "trainEventStarted", eventPayload);
}

function emitTrainEventEnded(room, eventPayload) {
  emitToRoom(room, "trainEventEnded", eventPayload);
}

function clearCurrentWeatherEvent(room, reason = "cleared") {
  const currentEvent = room.weatherActiveEvent || room.weatherQueuedEvent;
  if (!currentEvent) return false;

  clearTimerSet(room.weatherRuntimeTimers);
  room.weatherQueuedEvent = null;
  room.weatherActiveEvent = null;

  emitWeatherEventEnded(room, {
    type: currentEvent.type,
    label: currentEvent.label,
    reason,
    endedAt: Date.now(),
  });
  return true;
}

function startQueuedWeatherEvent(room) {
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

  emitWeatherEventStarted(room, room.weatherActiveEvent);

  const endTimer = setTimeout(() => {
    room.weatherRuntimeTimers.delete(endTimer);
    if (!rooms.has(room.id)) return;
    clearCurrentWeatherEvent(room, "completed");
  }, config.durationMs + 30);
  trackTimer(room.weatherRuntimeTimers, endTimer);
  return true;
}

function queueRoomWeatherEvent(room, type, source = "rng") {
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
  emitWeatherEventQueued(room, room.weatherQueuedEvent);

  const startTimer = setTimeout(() => {
    room.weatherRuntimeTimers.delete(startTimer);
    if (!rooms.has(room.id)) return;
    startQueuedWeatherEvent(room);
  }, WEATHER_EVENT_WARNING_MS);
  trackTimer(room.weatherRuntimeTimers, startTimer);
  return true;
}

function scheduleRandomWeatherEvents(room) {
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
      if (!rooms.has(room.id)) return;
      queueRoomWeatherEvent(room, type, "rng");
    }, nextQueueDelayMs);
    trackTimer(room.weatherScheduleTimers, timer);

    nextQueueDelayMs +=
      WEATHER_EVENT_WARNING_MS +
      WEATHER_EVENT_CONFIG[type].durationMs +
      randomInt(WEATHER_GAP_DELAY_RANGE_MS.min, WEATHER_GAP_DELAY_RANGE_MS.max);
  }
}

function clearCurrentTrainEvent(room, reason = "completed") {
  const currentEvent = room.trainActiveEvent;
  if (!currentEvent) return false;

  clearTimerSet(room.trainRuntimeTimers);
  room.trainActiveEvent = null;
  emitTrainEventEnded(room, {
    id: currentEvent.id,
    label: currentEvent.label,
    endedAt: Date.now(),
    reason,
  });
  return true;
}

function startTrainEvent(room, id, source = "rng") {
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
  emitTrainEventStarted(room, room.trainActiveEvent);

  const timer = setTimeout(() => {
    room.trainRuntimeTimers.delete(timer);
    if (!rooms.has(room.id)) return;
    clearCurrentTrainEvent(room, "completed");
  }, config.durationMs + 30);
  trackTimer(room.trainRuntimeTimers, timer);
  return true;
}

function scheduleRandomTrainEvents(room) {
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
      if (!rooms.has(room.id)) return;
      startTrainEvent(room, eventId, "rng");
    }, nextDelayMs);
    trackTimer(room.trainScheduleTimers, timer);

    nextDelayMs +=
      TRAIN_EVENT_CONFIG[eventId].durationMs +
      randomInt(TRAIN_GAP_DELAY_RANGE_MS.min, TRAIN_GAP_DELAY_RANGE_MS.max);
  }
}
function maybeFinalizeMatch(room, reason = "all_finished") {
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
    : maxReportedElapsedMs || getElapsedSinceStartMs(room);
  return finalizeMatchWithReports(room, timeCapMs, timeoutReached);
}

function startFinishWindowIfNeeded(room, firstReport) {
  if (room.finishWindowEndsAtMs > 0) return;
  if (room.players.size <= 1) {
    maybeFinalizeMatch(room, "all_finished");
    return;
  }

  room.finishWindowEndsAtMs = Date.now() + FINISH_WINDOW_MS;
  emitToRoom(room, "finishWindowStarted", {
    leaderId: firstReport.id,
    leaderName: firstReport.name,
    startedAt: Date.now(),
    endsAt: room.finishWindowEndsAtMs,
    durationMs: FINISH_WINDOW_MS,
    ...getRoomMeta(room),
  });

  room.finishWindowTimer = setTimeout(() => {
    if (!rooms.has(room.id)) return;
    maybeFinalizeMatch(room, "timeout");
  }, FINISH_WINDOW_MS + 50);
}

function sanitizeRoomJoinPayload(payload = {}) {
  const roomMode = Object.values(REGISTER_ROOM_MODES).includes(payload.roomMode)
    ? payload.roomMode
    : REGISTER_ROOM_MODES.PUBLIC;
  const name = typeof payload.name === "string" ? payload.name : "";
  const roomCode = normalizeRoomCode(payload.roomCode || "");
  return {
    roomMode,
    name,
    roomCode,
  };
}

function buildPlayerRecord(name) {
  return {
    name,
    ready: false,
    state: { x: 0, y: 0, angle: 0 },
    progress: createEmptyProgressState(),
    inventory: [],
    claimedRouteRewards: new Set(),
  };
}

function assignPlayerToRoom(room, socket, payload = {}) {
  const number = room.players.size + 1;
  const safeName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim().slice(0, 18)
      : `Jugador ${number}`;

  socket.join(getRoomChannel(room.id));
  room.players.set(socket.id, buildPlayerRecord(safeName));
  playerRoomIds.set(socket.id, room.id);
  ensureHost(room);

  socket.emit("initState", {
    selfId: socket.id,
    players: buildPlayersPayload(room),
    room: getRoomMeta(room),
  });
  refreshLobbyStartFlow(room);
  emitLobbyState(room);
}

function resolveTargetRoom(joinPayload) {
  if (joinPayload.roomMode === REGISTER_ROOM_MODES.PUBLIC) {
    return { room: getOrCreatePublicRoom(), error: null };
  }

  if (joinPayload.roomMode === REGISTER_ROOM_MODES.PRIVATE_CREATE) {
    const roomCode = generateUniquePrivateCode(joinPayload.roomCode);
    return {
      room: createRoom({
        type: ROOM_TYPE_PRIVATE,
        code: roomCode,
      }),
      error: null,
    };
  }

  if (joinPayload.roomMode === REGISTER_ROOM_MODES.PRIVATE_JOIN) {
    if (!joinPayload.roomCode) {
      return {
        room: null,
        error: {
          code: "ROOM_CODE_REQUIRED",
          message: "Escribe un codigo para entrar a una sala privada.",
        },
      };
    }

    const room = findRoomByCode(joinPayload.roomCode);
    if (!room) {
      return {
        room: null,
        error: {
          code: "ROOM_NOT_FOUND",
          message: "No existe una sala privada con ese codigo.",
        },
      };
    }

    return { room, error: null };
  }

  return {
    room: null,
    error: {
      code: "ROOM_MODE_INVALID",
      message: "Modo de sala invalido.",
    },
  };
}

function emitRoomError(socket, payload) {
  socket.emit("roomError", payload);
}

io.on("connection", (socket) => {
  socket.on("registerPlayer", (payload = {}) => {
    const existingRoom = getRoomBySocketId(socket.id);
    if (existingRoom?.players.has(socket.id)) {
      socket.emit("initState", {
        selfId: socket.id,
        players: buildPlayersPayload(existingRoom),
        room: getRoomMeta(existingRoom),
      });
      emitLobbyState(existingRoom);
      return;
    }

    const joinPayload = sanitizeRoomJoinPayload(payload);
    const { room, error } = resolveTargetRoom(joinPayload);
    if (error) {
      emitRoomError(socket, error);
      return;
    }
    if (!room) {
      emitRoomError(socket, {
        code: "ROOM_UNAVAILABLE",
        message: "No se pudo resolver la sala.",
      });
      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      emitRoomError(socket, {
        code: "ROOM_FULL",
        message: "Sala llena (maximo 6 jugadores).",
      });
      return;
    }

    if (room.started) {
      emitRoomError(socket, {
        code: "ROOM_IN_PROGRESS",
        message: "La partida ya inicio. Espera reinicio de sala.",
      });
      return;
    }

    assignPlayerToRoom(room, socket, joinPayload);
  });

  socket.on("setLobbyReady", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || room.started) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const nextReady =
      typeof payload.ready === "boolean" ? payload.ready : !Boolean(player.ready);
    if (Boolean(player.ready) === nextReady) return;
    player.ready = nextReady;
    refreshLobbyStartFlow(room);
    emitLobbyState(room);
  });

  socket.on("startGame", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || room.started || room.players.size === 0) return;
    if (room.type !== ROOM_TYPE_PRIVATE) return;
    if (socket.id !== room.hostId) return;

    const preferredSpawn = sanitizeState(payload.preferredSpawn, {
      x: 600,
      y: 5200,
      angle: 0,
    });
    const everyoneReady = isLobbyEveryoneReady(room);
    scheduleLobbyCountdown(room, {
      durationMs: everyoneReady
        ? LOBBY_COUNTDOWN_READY_MS
        : LOBBY_COUNTDOWN_DEFAULT_MS,
      reason: everyoneReady ? "all_ready" : "private_start",
      preferredSpawn,
      requestedById: socket.id,
    });
  });

  socket.on("updatePosition", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || !room.started || room.finished) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const next = sanitizeState(payload, player.state);
    const nextProgress = sanitizeProgressPayload(payload.progress, player.progress);
    player.state = next;
    player.progress = nextProgress;

    socket.to(getRoomChannel(room.id)).emit("playerMoved", {
      id: socket.id,
      ...next,
    });
  });

  socket.on("finishMatch", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || !room.started || room.finished) return;

    const report = storeFinishReport(room, socket.id, payload);
    if (!report) return;

    if (!payload.finalizeNow && room.finishReports.size === 1) {
      startFinishWindowIfNeeded(room, report);
    }

    maybeFinalizeMatch(room, "all_finished");
  });

  socket.on("debugSetFinishReport", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;

    const requestedPlayerId =
      typeof payload.playerId === "string" ? payload.playerId.trim() : "";
    const targetPlayerId = requestedPlayerId || socket.id;
    if (!room.players.has(targetPlayerId)) return;

    const elapsedSeconds = sanitizeElapsedSeconds(
      payload.elapsedSeconds,
      getElapsedSinceStartMs(room) / 1000
    );
    const report = storeFinishReport(
      room,
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
      startFinishWindowIfNeeded(room, report);
    }

    if (payload.finalizeNow) {
      scheduleDebugFinalize(room, true);
      return;
    }

    maybeFinalizeMatch(room, "all_finished");
  });
  socket.on("debugFinalizeMatch", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room || socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;

    scheduleDebugFinalize(room, true);
  });

  socket.on("restartLobby", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room || socket.id !== room.hostId) return;
    restartLobbyForEveryone(room, "host");
  });

  socket.on("requestLobbyReturn", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room || !room.players.has(socket.id)) return;
    if (!room.finished) return;
    restartLobbyForEveryone(room, "player");
  });

  socket.on("queueWeatherEvent", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;

    const type =
      typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";
    queueRoomWeatherEvent(room, type, "host");
  });

  socket.on("clearWeatherEvent", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room || socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;
    clearCurrentWeatherEvent(room, "host_clear");
  });

  socket.on("startTrainEvent", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;

    const requestedId =
      typeof payload.id === "string" ? payload.id.trim() : "";
    const nextId = TRAIN_EVENT_CONFIG[requestedId]
      ? requestedId
      : pickRandomTrainEventId();
    startTrainEvent(room, nextId, "host");
  });

  socket.on("grantItem", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || socket.id !== room.hostId) return;
    if (!room.started || room.finished) return;

    const type =
      typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";
    grantInventoryItem(room, socket.id, type);
  });

  socket.on("claimRouteReward", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || !room.started || room.finished) return;

    const rewardKey =
      typeof payload.rewardKey === "string" ? payload.rewardKey.trim() : "";
    if (!rewardKey) return;
    claimRouteReward(room, socket.id, rewardKey);
  });

  socket.on("dropItem", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room || !room.started || room.finished) return;
    dropInventoryItem(room, socket.id);
  });

  socket.on("triggerTrackItem", (payload = {}) => {
    const room = getRoomBySocketId(socket.id);
    if (!room || !room.started || room.finished) return;

    const id = typeof payload.id === "string" ? payload.id.trim() : "";
    const type =
      typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "";
    if (!id) return;
    triggerTrackItem(room, socket.id, id, type);
  });

  socket.on("disconnect", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room) return;

    const hadPlayer = room.players.delete(socket.id);
    if (!hadPlayer) {
      playerRoomIds.delete(socket.id);
      return;
    }

    playerRoomIds.delete(socket.id);
    room.finishReports.delete(socket.id);
    ensureHost(room);
    socket.to(getRoomChannel(room.id)).emit("playerDisconnected", {
      id: socket.id,
    });

    if (room.players.size === 0) {
      destroyRoom(room);
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
      clearRoomItems(room);
    } else {
      maybeFinalizeMatch(room, "all_finished");
    }

    refreshLobbyStartFlow(room);
    emitLobbyState(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[socket-server] running on http://localhost:${PORT}`);
});
