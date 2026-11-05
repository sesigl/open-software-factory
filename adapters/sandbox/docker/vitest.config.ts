import { defineConfig } from "vitest/config";

// System tests of this adapter: the @conformance scenarios of ports/sandbox/features/ and its own, against the
// Docker host and iron-proxy. Turbo replays their results on pull requests (ADR 0081).
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files and imports the testkit once (ADR 0051).
    isolate: false,
    testTimeout: 120_000,
    reporters: ["default", ["junit", { outputFile: "reports/junit.xml", classnameTemplate: "{filepath}" }]],
  },
});
