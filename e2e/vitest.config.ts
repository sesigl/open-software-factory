import { defineConfig } from "vitest/config";

// The end-to-end scenarios on the Compose profile (ADR 0076). Turbo never caches them, so PASS always reads the results
// of this run.
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files and imports the testkit once (ADR 0051).
    isolate: false,
    // A scenario starts the whole profile; a run of the factory takes some seconds more.
    testTimeout: 600_000,
    hookTimeout: 120_000,
    reporters: ["default", ["junit", { outputFile: "../reports/junit/e2e.xml", classnameTemplate: "{filepath}" }]],
  },
});
