import { io } from "socket.io-client";

function getDefaultServerUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname || "localhost";
  return `${protocol}://${host}:3000`;
}

export function createSocketConnection() {
  const serverUrl =
    import.meta.env.VITE_SOCKET_SERVER_URL || getDefaultServerUrl();

  return io(serverUrl, {
    transports: ["websocket"],
  });
}
