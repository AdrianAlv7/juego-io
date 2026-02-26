import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3000);
const SPAWN_GAP = 90;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Estado de jugadores conectado al servidor.
const players = new Map();
let baseSpawn = null;

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

function assignSpawn(preferredSpawn) {
  if (!baseSpawn) {
    baseSpawn = sanitizeState(preferredSpawn, { x: 600, y: 5200, angle: 0 });
  }

  // Los jugadores aparecen en fila/columna a la par del primero.
  const index = players.size;
  const rowSize = 4;
  const column = index % rowSize;
  const row = Math.floor(index / rowSize);

  return {
    x: baseSpawn.x + column * SPAWN_GAP,
    y: baseSpawn.y + row * SPAWN_GAP,
    angle: baseSpawn.angle ?? 0,
  };
}

io.on("connection", (socket) => {
  socket.on("registerPlayer", (payload = {}) => {
    const spawn = assignSpawn(payload.preferredSpawn);
    const playerState = sanitizeState(spawn, spawn);
    players.set(socket.id, playerState);

    socket.emit("initState", {
      selfId: socket.id,
      players: Object.fromEntries(players),
    });

    socket.broadcast.emit("playerJoined", {
      id: socket.id,
      state: playerState,
    });
  });

  socket.on("updatePosition", (payload = {}) => {
    const current = players.get(socket.id);
    if (!current) return;

    const next = sanitizeState(payload, current);
    players.set(socket.id, next);

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      ...next,
    });
  });

  socket.on("disconnect", () => {
    const hadPlayer = players.delete(socket.id);
    if (!hadPlayer) return;

    socket.broadcast.emit("playerDisconnected", {
      id: socket.id,
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`[socket-server] running on http://localhost:${PORT}`);
});
