import { defineConfig } from "vitest/config";

// System tests of this module. Their results stay in its reports/, which turbo replays on pull requests (ADR 0081).
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files and imports the testkit once (ADR 0051).
    isolate: false,
    testTimeout: 120_000,
    // Each scenario starts Temporal, the foreman and its harness adapters: two at a time keep a runner responsive.
    maxWorkers: 2,
    reporters: ["default", ["junit", { outputFile: "reports/junit.xml", classnameTemplate: "{filepath}" }]],
  },
});
