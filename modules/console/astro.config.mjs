// Astro renders the templates in src/web/ inside the Fastify server of `console serve`, in the Node adapter's
// middleware mode (ADR 0132). A Fastify route loads the page's data and hands it to the template as locals.page.
import { createRequire } from "node:module";
import { dirname } from "node:path";
import node from "@astrojs/node";
import { defineConfig } from "astro/config";

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
});
