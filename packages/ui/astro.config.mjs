// The workbench (ADR 0152): plain Astro pages, one per island and state, built into the static folder
// dist/workbench/, which the island scenarios serve with sut.site under the console's Content-Security-Policy.
import { defineConfig } from "astro/config";
import solid from "vite-plugin-solid";

export default defineConfig({
  srcDir: "./workbench",
  publicDir: "./workbench/public",
  outDir: "./dist/workbench",
  output: "static",
  devToolbar: { enabled: false },
  // No inline stylesheet and no inline script: the policy allows only the page's own files.
  build: { inlineStylesheets: "never" },
  vite: {
    // SolidJS compiles the islands' JSX into DOM code; nothing else of the package is .tsx.
    plugins: [solid()],
    // An island's script stays a file of its own, never inlined into the page (ADR 0152).
    build: { assetsInlineLimit: 0 },
  },
});
