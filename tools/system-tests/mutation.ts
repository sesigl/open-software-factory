// The base commit and change of the MUTATION scenarios: module demo with src/run.ts.
import type { scenario } from "@opensoftware/testkit";
import { mutationPackage, prefixes, qualityLimits } from "./repo.ts";

type Sut = Parameters<Parameters<typeof scenario>[1]>[0]["sut"];

const line = (n: number): string => `export const line${n} = ${n};`;

/** Commits module demo whose src/run.ts has `count` lines; returns the commit. */
export async function demoBase(sut: Sut, count: number): Promise<string> {
  await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", prefixes(["DEMO", "modules/demo/features/"]));
  await sut.files.put("$INPUT/modules/demo/package.json", mutationPackage("demo"));
  await sut.files.put("$INPUT/modules/demo/AGENTS.md", qualityLimits({ changed: 70, total: 80 }));
  const lines = Array.from({ length: count }, (_, index) => line(index + 1));
  await sut.files.put("$INPUT/modules/demo/src/run.ts", `${lines.join("\n")}\n`);
  return sut.git.commit("base");
}

/** Rewrites src/run.ts so that the lines `added` are new and the others are the base lines in order. */
export async function addLines(sut: Sut, total: number, added: number[]): Promise<void> {
  let next = 1;
  const lines = Array.from({ length: total }, (_, index) =>
    added.includes(index + 1) ? `export const added${index + 1} = 0;` : line(next++),
  );
  await sut.files.put("$INPUT/modules/demo/src/run.ts", `${lines.join("\n")}\n`);
}

/** Writes module `name` with a mutation script, the `osf` settings of its package.json and src/run.ts of `count` lines. */
export async function demoModule(
  sut: Sut,
  name: string,
  count: number,
  settings: Record<string, number> = {},
): Promise<void> {
  const manifest = { ...JSON.parse(mutationPackage(name)), osf: settings };
  await sut.files.put(`$INPUT/modules/${name}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  await sut.files.put(`$INPUT/modules/${name}/AGENTS.md`, qualityLimits());
  const lines = Array.from({ length: count }, (_, index) => line(index + 1));
  await sut.files.put(`$INPUT/modules/${name}/src/run.ts`, `${lines.join("\n")}\n`);
}

/** The shards of `osf mutation-plan` output, as "folder shard". */
export function shardsOf(stdout: string): string[] {
  const plan = JSON.parse(stdout) as { folder: string; shard: string }[];
  return plan.map(({ folder, shard }) => `${folder} ${shard}`);
}

/** The root files of a Turborepo whose units have a `mutation` task that depends on the builds of their packages. */
export async function turboRoot(sut: Sut): Promise<void> {
  const root = { name: "repo", private: true, packageManager: "pnpm@10.28.0" };
  await sut.files.put("$INPUT/package.json", `${JSON.stringify(root, null, 2)}\n`);
  await sut.files.put("$INPUT/pnpm-workspace.yaml", "packages:\n  - modules/*\n  - packages/*\n");
  const turbo = { tasks: { build: { dependsOn: ["^build"] }, mutation: { dependsOn: ["^build"], cache: false } } };
  await sut.files.put("$INPUT/turbo.json", `${JSON.stringify(turbo, null, 2)}\n`);
}

/** The `key` or `guard` of a shard of `osf mutation-plan --keys` output. */
export function keyOf(stdout: string, folder: string, field: "key" | "guard", shard = "1/1"): string | undefined {
  const plan = JSON.parse(stdout) as { folder: string; shard: string; key?: string; guard?: string }[];
  return plan.find((entry) => entry.folder === folder && entry.shard === shard)?.[field];
}
