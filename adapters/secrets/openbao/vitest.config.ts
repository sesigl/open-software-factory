import { defineConfig } from "vitest/config";

// System tests of this adapter: the @conformance scenarios of ports/secrets/features/ and its own scenarios in
// features/, against the testkit's OpenBao.
// Turbo replays their results on pull requests (ADR 0081).
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files, imports the testkit once and shares one OpenBao (ADR 0051, ADR 0137).
    isolate: false,
    testTimeout: 60_000,
    reporters: ["default", ["junit", { outputFile: "reports/junit.xml", classnameTemplate: "{filepath}" }]],
  },
});
