import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Permite abrir el cliente desde otros dispositivos de la LAN sin pasar --host.
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
