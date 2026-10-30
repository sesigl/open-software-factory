import { defineConfig } from "vitest/config";

// SMOKE-PAID: one real-model run per first-party harness (ADR 0077). Only `make smoke-paid` runs it, never verify.
export default defineConfig({
  test: {
    include: ["paid/**/*.paid.ts"],
    globals: true,
    retry: 0,
    // A real model takes some minutes for a small task; a run that takes longer costs too much.
    testTimeout: 300_000,
    reporters: ["default"],
  },
});
