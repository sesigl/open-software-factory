import { defineConfig } from "vitest/config";

// System tests of this adapter: the @conformance scenarios of ports/forge/features/ and its own scenarios in
// features/, against the testkit's Forgejo.
// Turbo replays their results on pull requests (ADR 0081).
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files and imports the testkit once (ADR 0051).
    isolate: false,
    testTimeout: 180_000,
    reporters: ["default", ["junit", { outputFile: "reports/junit.xml", classnameTemplate: "{filepath}" }]],
  },
});
