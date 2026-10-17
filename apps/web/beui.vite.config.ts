import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(here, "beui-src"),
    },
  },
  build: {
    outDir: "dist-beui",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(here, "index.html"),
        editor: resolve(here, "editor.html"),
        beui: resolve(here, "beui.html"),
      },
    },
  },
});
