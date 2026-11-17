import { defineConfig } from "vitest/config";

// System tests of the Compose profile. Turbo replays their results on pull requests (ADR 0081).
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
    // The run's shared starts (ADR 0157): one start of the profile and one install of the chart for the scenarios
    // tagged @shared=compose-profile and @shared=helm-chart, taken down when the run ends.
    globalSetup: ["@opensoftware/testkit/global-setup"],
    // The teardown takes the profile and the chart's namespace down.
    teardownTimeout: 300_000,
    reporters: ["default", ["junit", { outputFile: "reports/junit.xml", classnameTemplate: "{filepath}" }]],
  },
});
