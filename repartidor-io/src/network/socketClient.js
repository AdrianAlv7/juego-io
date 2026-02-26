import { io } from "socket.io-client";

const DEFAULT_SERVER_URL = "http://localhost:3000";

export function createSocketConnection() {
  const serverUrl =
    import.meta.env.VITE_SOCKET_SERVER_URL || DEFAULT_SERVER_URL;

  return io(serverUrl, {
    transports: ["websocket"],
  });
}
