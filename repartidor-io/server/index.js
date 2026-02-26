import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 4;
const SPAWN_GAP = 90;
const SPAWN_COLUMNS = 2;

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
  room.started = false;
  room.finished = false;
  room.baseSpawn = null;
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

  socket.on("finishMatch", () => {
    if (!room.started || room.finished) return;
    if (!room.players.has(socket.id)) return;

    room.finished = true;
    io.emit("matchFinished", {
      winnerId: socket.id,
    });
    emitLobbyState();
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

    ensureHost();
    socket.broadcast.emit("playerDisconnected", {
      id: socket.id,
    });

    if (room.players.size === 0) {
      room.hostId = null;
      resetMatchState();
      return;
    }

    emitLobbyState();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[socket-server] running on http://localhost:${PORT}`);
});
