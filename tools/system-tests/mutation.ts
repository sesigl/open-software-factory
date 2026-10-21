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
