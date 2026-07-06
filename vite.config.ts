import { defineConfig } from "vite";

// Repo is served from https://<user>.github.io/bomber/ on GitHub Pages.
// Locally (dev/preview) we want "/" so the app loads at the root.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/bomber/" : "/",
  build: {
    target: "es2020",
    sourcemap: true,
  },
}));
