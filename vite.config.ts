import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  // Magenta's default compatibility module assumes window; its browser variant also supports workers.
  resolve: {
    alias: [
      {
        find: /^(.*\/)?compat\/global$/,
        replacement: fileURLToPath(
          new URL(
            "./node_modules/@magenta/music/esm/core/compat/global_browser.js",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
  server: {
    host: "0.0.0.0",
    fs: { deny: [".env", ".env.*", "**/.data/**", "**/.npm-cache/**"] },
  },
});
