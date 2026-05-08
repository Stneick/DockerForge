import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Dev server runs on :3000 because the backend's default CORS origin is
// http://localhost:3000. The /api proxy forwards to the FastAPI backend so
// httponly auth cookies stay same-site. Override the target with VITE_API_TARGET
// (the backend is currently on :7000).
const API_TARGET = process.env.VITE_API_TARGET ?? "http://localhost:7000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        // SSE endpoints must not be buffered.
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Accept-Encoding", "identity");
          });
        },
      },
    },
  },
});
