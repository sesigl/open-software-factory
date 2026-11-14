// The module demo of the DEPS-RUNTIME scenarios (ADR 0138): a published package whose bin dist/cli.js is built from
// src/cli.ts, which imports ./serve.js, also through ./doctor.js. Each scenario gives src/serve.ts and the package's
// dependency lists.
import { putAll } from "./repo.ts";

type Sut = Parameters<typeof putAll>[0] & {
  cli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

/** The workspace with modules/demo; `manifest` adds to its package.json, `files` to its folder. */
export function shippedModule(manifest: Record<string, unknown> = {}, files: Record<string, string> = {}) {
  const demo = { name: "@opensoftware/demo", version: "0.1.0", type: "module", bin: { demo: "dist/cli.js" } };
  const own = Object.fromEntries(Object.entries(files).map(([path, text]) => [`modules/demo/${path}`, text]));
  return {
    "pnpm-workspace.yaml": "packages:\n  - modules/*\n  - tools\n",
    "modules/demo/package.json": `${JSON.stringify({ ...demo, ...manifest }, null, 2)}\n`,
    "modules/demo/src/cli.ts": [
      'import { doctor } from "./doctor.js";',
      'import { serve } from "./serve.js";',
      "",
      'await (process.argv[2] === "doctor" ? doctor() : serve());',
      "",
    ].join("\n"),
    // A second way to serve.ts: the check reads each file once.
    "modules/demo/src/doctor.ts": 'import { serve } from "./serve.js";\n\nexport const doctor = serve;\n',
    ...own,
  };
}

/** Puts module demo with this src/serve.ts. */
export const putShipped = (sut: Sut, serve: string[], manifest: Record<string, unknown> = {}): Promise<void> =>
  putAll(sut, shippedModule(manifest, { "src/serve.ts": `${serve.join("\n")}\nexport async function serve() {}\n` }));

export const runShipped = (sut: Sut) => sut.cli(["check", "DEPS-RUNTIME"]);

/** The finding of a package that only the devDependencies list, on a line of src/serve.ts. */
export const devOnly = (line: number, name: string): string =>
  `DEPS-RUNTIME modules/demo/src/serve.ts:${line} ${name} is only a devDependency, which npm does not install with @opensoftware/demo: move it to dependencies, or stop loading it at run time\n`;

/** The finding of a package in no dependency list, on a line of src/serve.ts. */
export const undeclared = (line: number, name: string): string =>
  `DEPS-RUNTIME modules/demo/src/serve.ts:${line} ${name} is no dependency of @opensoftware/demo: add it to dependencies, or stop loading it at run time\n`;
