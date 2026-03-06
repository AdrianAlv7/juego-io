import { defineConfig } from "vite";

export default defineConfig({
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
