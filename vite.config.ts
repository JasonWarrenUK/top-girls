import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  server: {
    // Bind to 0.0.0.0 so devices on the same WiFi can reach the dev server.
    // "bun run dev" still works on localhost; "bun run dev:lan" additionally
    // prints the LAN URL so device 2 can connect.
    host: true,
  },
});
