// `pnpm build`: bundles the workflow code once into dist/workflows.bundle.js, which the worker loads instead of
// bundling at each start (ADR 0067). The source map names the files below src/, so coverage maps to them.
import { writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleWorkflowCode } from "@temporalio/worker";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { code } = await bundleWorkflowCode({
  workflowsPath: join(root, "src/workflows/run.ts"),
  logger: { trace() {}, debug() {}, info() {}, warn: console.warn, error: console.error, log() {} },
});
writeFileSync(join(root, "dist/workflows.bundle.js"), code);
process.stdout.write(`bundled the workflows into ${relative(process.cwd(), join(root, "dist/workflows.bundle.js"))}\n`);
