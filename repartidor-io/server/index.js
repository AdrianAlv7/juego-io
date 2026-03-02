import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 4;
const SPAWN_GAP = 90;
const SPAWN_COLUMNS = 2;
const MATCH_PRESTART_MS = 3000;
const FINISH_WINDOW_MS = 20000;

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
    maxPlayers: MAX_PLAYERS,
  });
}

function resetMatchState() {
  if (room.finishWindowTimer) {
    clearTimeout(room.finishWindowTimer);
    room.finishWindowTimer = null;
  }
  room.started = false;
  room.finished = false;
  room.baseSpawn = null;
  room.matchStartedAtMs = 0;
  room.finishReports.clear();
  room.finishWindowEndsAtMs = 0;
  for (const player of room.players.values()) {
    player.state = { x: 0, y: 0, angle: 0 };
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

function scoreAndRankResults(results = [], timeCapMs = 0) {
  const finishers = results.filter((entry) => entry.didFinish);
  const fastestMs = finishers.length
    ? Math.min(...finishers.map((entry) => entry.elapsedMs))
    : Math.max(0, timeCapMs);
  const safeCapMs = Math.max(fastestMs + 1, Math.round(timeCapMs));
  const rangeMs = Math.max(1, safeCapMs - fastestMs);

  const withScores = results.map((entry) => {
    const qualityScore = entry.didFinish ? entry.qualityPercent : 0;
    const timeScore = entry.didFinish
      ? Math.round(
          Math.max(0, ((safeCapMs - entry.elapsedMs) / rangeMs) * 100)
        )
      : 0;
    const score = qualityScore + timeScore;

    return {
      ...entry,
      qualityScore,
      timeScore,
      score,
    };
  });

  return withScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.qualityPercent !== a.qualityPercent) {
      return b.qualityPercent - a.qualityPercent;
    }
    if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
    return a.name.localeCompare(b.name);
  });
}

function getElapsedSinceStartMs() {
  if (!room.matchStartedAtMs) return 0;
  return Math.max(0, Date.now() - room.matchStartedAtMs - MATCH_PRESTART_MS);
}

function maybeFinalizeMatch(reason = "all_finished") {
  if (!room.started || room.finished) return false;
  if (room.players.size === 0) return false;

  const everyoneFinished = room.finishReports.size >= room.players.size;
  const timeoutReached =
    reason === "timeout" ||
    (room.finishWindowEndsAtMs > 0 && Date.now() >= room.finishWindowEndsAtMs);

  if (!everyoneFinished && !timeoutReached) return false;

  if (room.finishWindowTimer) {
    clearTimeout(room.finishWindowTimer);
    room.finishWindowTimer = null;
  }

  const currentReports = Array.from(room.finishReports.values());
  const timeCapMs = timeoutReached
    ? Math.max(0, room.finishWindowEndsAtMs - room.matchStartedAtMs - MATCH_PRESTART_MS)
    : currentReports.length
      ? Math.max(...currentReports.map((entry) => entry.elapsedMs))
      : getElapsedSinceStartMs();

  const resultsById = new Map(room.finishReports);
  if (timeoutReached) {
    for (const [id, player] of room.players.entries()) {
      if (resultsById.has(id)) continue;
      resultsById.set(id, {
        id,
        name: player.name,
        elapsedMs: timeCapMs,
        qualityPercent: 0,
        didFinish: false,
      });
    }
  }

  const ranked = scoreAndRankResults(Array.from(resultsById.values()), timeCapMs);
  room.finished = true;
  room.finishWindowEndsAtMs = 0;
  io.emit("matchFinished", {
    winnerId: ranked[0]?.id || null,
    results: ranked,
    finishedAt: Date.now(),
  });
  emitLobbyState();
  return true;
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

    io.emit("gameStarted", {
      startedAt: Date.now(),
      players: buildPlayersPayload(),
    });
    emitLobbyState();
  });

  socket.on("updatePosition", (payload = {}) => {
    if (!room.started || room.finished) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    const next = sanitizeState(payload, player.state);
    player.state = next;

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      ...next,
    });
  });

  socket.on("finishMatch", (payload = {}) => {
    if (!room.started || room.finished) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    if (room.finishReports.has(socket.id)) return;

    const elapsedMs = sanitizeElapsedMs(payload.elapsedMs, getElapsedSinceStartMs());
    const report = {
      id: socket.id,
      name: player.name,
      elapsedMs,
      qualityPercent: sanitizeQualityPercent(payload.qualityPercent, 0),
      didFinish: true,
    };
    room.finishReports.set(socket.id, report);

    if (room.finishReports.size === 1) {
      startFinishWindowIfNeeded(report);
    }

    maybeFinalizeMatch("all_finished");
  });

  socket.on("restartLobby", () => {
    if (socket.id !== room.hostId) return;
    resetMatchState();
    io.emit("lobbyRestarted");
    emitLobbyState();
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
    } else {
      maybeFinalizeMatch("all_finished");
    }
    emitLobbyState();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[socket-server] running on http://localhost:${PORT}`);
});
