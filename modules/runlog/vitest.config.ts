import { defineConfig } from "vitest/config";

// System tests of this module. Turbo never caches them, so PASS always reads the results of this run.
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    testTimeout: 60_000,
    // Two files at a time: the Collector scenarios start containers, and more workers slow the suites that run
    // next to this one in make verify past their BUDGET.
    maxWorkers: 2,
    reporters: [
      "default",
      ["junit", { outputFile: "../../reports/junit/runlog.xml", classnameTemplate: "{filepath}" }],
    ],
  },
});
