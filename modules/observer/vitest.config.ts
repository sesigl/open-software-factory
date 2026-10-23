import { defineConfig } from "vitest/config";

// System tests of this module. Turbo never caches them, so PASS always reads the results of this run.
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files and imports the testkit once (ADR 0051).
    isolate: false,
    testTimeout: 60_000,
    reporters: [
      "default",
      ["junit", { outputFile: "../../reports/junit/observer.xml", classnameTemplate: "{filepath}" }],
    ],
  },
});
