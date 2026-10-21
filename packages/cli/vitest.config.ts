import { defineConfig } from "vitest/config";

// System tests of the cli library. Turbo never caches them, so PASS always reads the results of this run.
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    testTimeout: 60_000,
    reporters: ["default", ["junit", { outputFile: "../../reports/junit/cli.xml", classnameTemplate: "{filepath}" }]],
  },
});
