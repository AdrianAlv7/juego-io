import { io } from "socket.io-client";

function normalizeServerUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function getDefaultServerUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  if (!import.meta.env.DEV) {
    return window.location.origin;
  }

  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname || "localhost";
  return `${protocol}://${host}:3000`;
}

export function createSocketConnection() {
  const serverUrl = normalizeServerUrl(
    import.meta.env.VITE_SOCKET_SERVER_URL || getDefaultServerUrl()
  );

  if (import.meta.env.DEV) {
    console.info("[socket] connecting to", serverUrl);
  }

  return io(serverUrl, {
    transports: ["polling", "websocket"],
  });
}
