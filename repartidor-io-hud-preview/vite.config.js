import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser/")) {
            return "vendor-phaser";
          }
          if (
            id.includes("node_modules/socket.io-client/") ||
            id.includes("node_modules/engine.io-client/") ||
            id.includes("node_modules/socket.io-parser/") ||
            id.includes("node_modules/engine.io-parser/")
          ) {
            return "vendor-socket";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    // Permite abrir el cliente desde otros dispositivos de la LAN sin pasar --host.
    host: true,
    // Cloudflare Quick Tunnel usa subdominios *.trycloudflare.com.
    allowedHosts: [".trycloudflare.com"],
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
