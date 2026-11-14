// Astro renders the templates in src/web/ inside the Fastify server of `console serve`, in the Node adapter's
// middleware mode (ADR 0132). A Fastify route loads the page's data and hands it to the template as locals.page.
import node from "@astrojs/node";
import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "./src/web",
  outDir: "./dist/web",
  output: "server",
  adapter: node({ mode: "middleware" }),
  devToolbar: { enabled: false },
  // Every style comes from the console's own files: no inline stylesheet, which the Content-Security-Policy forbids.
  build: { inlineStylesheets: "never" },
});
