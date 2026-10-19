import { defineConfig } from "vitest/config";

// One configuration for every TypeScript system test in the repository. Paths in the JUnit report are
// relative to the repository root, so PASS, FLAKE and BUDGET can map each result to its module.
export default defineConfig({
  test: {
    include: ["**/system-tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "modules/_template/**"],
    globals: true,
    retry: 0,
    testTimeout: 60_000,
    reporters: ["default", ["junit", { outputFile: "reports/junit/vitest.xml", classnameTemplate: "{filepath}" }]],
  },
});
