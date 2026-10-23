import { defineConfig } from "vitest/config";

// System tests of this adapter: the @conformance scenarios of ports/sandbox/features/ and its own, against the
// cluster of KUBECONFIG with agent-sandbox (kind in CI). Turbo never caches them, so PASS reads this run's results.
export default defineConfig({
  test: {
    include: ["system-tests/**/*.test.ts"],
    globals: true,
    retry: 0,
    // A worker runs many scenario files and imports the testkit once (ADR 0051).
    isolate: false,
    // A scenario starts one or two pods and an egress pod each, and waits for agent-sandbox's controller.
    testTimeout: 240_000,
    reporters: [
      "default",
      ["junit", { outputFile: "../../../reports/junit/sandbox-kubernetes.xml", classnameTemplate: "{filepath}" }],
    ],
  },
});
