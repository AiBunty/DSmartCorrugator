import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const backendPort = process.env.BACKEND_PORT || "8000";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
