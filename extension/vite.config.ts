import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, searchForWorkspaceRoot } from "vite"
import { crx } from "@crxjs/vite-plugin"

import manifest from "./manifest.json" with { type: "json" }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    fs: {
      // extension/ imports files from ../src/ (outside this project root, e.g.
      // VacancyDetailEditor / cleanLinkedInJobUrl / database.types in later
      // phases) — without this, `npm run dev` 403s on those relative imports
      // even though `npm run build` (rollup) is unaffected.
      allow: [searchForWorkspaceRoot(process.cwd()), ".."],
    },
  },
})
