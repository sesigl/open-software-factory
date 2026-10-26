import { defineConfig } from "vitest/config";

// System tests of this module. Turbo never caches them, so PASS always reads the results of this run.
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
    reporters: [
      "default",
      ["junit", { outputFile: "../../reports/junit/foreman.xml", classnameTemplate: "{filepath}" }],
    ],
  },
});
