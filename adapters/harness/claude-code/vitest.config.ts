import { defineConfig } from "vitest/config";

// System tests of this adapter: the @conformance scenarios of ports/harness/features/ and its own, against the real
// Claude Code and the testkit's model gateway. Turbo never caches them, so PASS always reads the results of this run.
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    testTimeout: 60_000,
    reporters: [
      "default",
      ["junit", { outputFile: "../../../reports/junit/harness-claude-code.xml", classnameTemplate: "{filepath}" }],
    ],
  },
});
