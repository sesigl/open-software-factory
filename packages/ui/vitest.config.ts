import { defineConfig } from "vitest/config";

// System tests of the ui library. Turbo replays their results on pull requests (ADR 0081).
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files and imports the testkit once (ADR 0051).
    isolate: false,
    // One worker, so one Chromium per run: each mutant reruns every scenario while Stryker runs one mutant per CPU,
    // and with a Chromium per worker a run of a mutant that changes nothing took longer than Stryker's timeout, which
    // counted it as detected (ADR 0152).
    maxWorkers: 1,
    testTimeout: 60_000,
    reporters: ["default", ["junit", { outputFile: "reports/junit.xml", classnameTemplate: "{filepath}" }]],
  },
});
