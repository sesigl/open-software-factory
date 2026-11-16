// Astro renders the templates in src/web/ inside the Fastify server of `console serve`, in the Node adapter's
// middleware mode (ADR 0132). A Fastify route loads the page's data and hands it to the template as locals.page.
import { createRequire } from "node:module";
import { dirname } from "node:path";
import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import solid from "vite-plugin-solid";

// The design system is a devDependency: the build copies its brand files into dist/web/client/, so the published
// console serves its favicon from its own files.
const brand = dirname(createRequire(import.meta.url).resolve("@opensoftware/ui/brand/favicon.svg"));

export default defineConfig({
  srcDir: "./src/web",
  outDir: "./dist/web",
  publicDir: brand,
  output: "server",
  adapter: node({ mode: "middleware" }),
  devToolbar: { enabled: false },
  // Every style comes from the console's own files: no inline stylesheet, which the Content-Security-Policy forbids.
  build: { inlineStylesheets: "never" },
  vite: {
    // SolidJS compiles the JSX of the design system's islands into DOM code (ADR 0152).
    plugins: [solid()],
    // An island's script stays a file of its own in /_astro/, never inlined: the policy allows only script-src 'self'.
    build: { assetsInlineLimit: 0 },
  },
  // The Fastify route of a form checks its Origin before anything else (ADR 0089, ADR 0134) and answers a form from
  // another site with its own problem page; Astro only renders that answer, so its own check would replace the page.
  security: { checkOrigin: false },
});
