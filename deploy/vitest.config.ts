import { defineConfig } from "vitest/config";

// System tests of the Compose profile. Turbo never caches them, so PASS always reads the results of this run.
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files and imports the testkit once (ADR 0051).
    isolate: false,
    // A scenario that starts the profile builds the module images and pulls the services on its first run.
    testTimeout: 900_000,
    hookTimeout: 120_000,
    reporters: ["default", ["junit", { outputFile: "../reports/junit/deploy.xml", classnameTemplate: "{filepath}" }]],
  },
});
