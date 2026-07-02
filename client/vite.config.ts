import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

export default defineConfig({
  // simple-peer depends on readable-stream, which needs Node's stream/events/util/process/Buffer
  // globals to exist in the browser. Without this, Peer construction throws as soon as a real
  // remote peer connects (readable-stream's Readable constructor calls the Node `Stream` base
  // class, which Vite otherwise externalizes to an empty/undefined module).
  plugins: [react(), tailwindcss(), nodePolyfills({ globals: { Buffer: true, global: true, process: true } })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});