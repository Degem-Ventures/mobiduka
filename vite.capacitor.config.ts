import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const projectRoot = dirname(fileURLToPath(import.meta.url))
const apiOrigin =
  process.env.MOBIDUKA_API_ORIGIN?.replace(/\/+$/, "") ??
  "https://mobiduka.vercel.app"

export default defineConfig({
  root: resolve(projectRoot, "capacitor"),
  base: "./",
  publicDir: resolve(projectRoot, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": projectRoot },
  },
  define: {
    "process.env.NEXT_PUBLIC_API_ORIGIN": JSON.stringify(apiOrigin),
  },
  build: {
    outDir: resolve(projectRoot, "dist"),
    emptyOutDir: true,
  },
})
