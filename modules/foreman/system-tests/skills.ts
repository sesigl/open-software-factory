// The skills of other Git repositories in the scenarios (ADR 0146): $INPUT serves as that repository at a file:// URL,
// with the skill "review" in its folder shared/review, and factory.lock pins it.
import type { Fakes, Sut } from "@opensoftware/testkit";
import { readmeFiles } from "./foreman.ts";

export const SKILL = "---\nname: review\ndescription: Review a plan.\n---\nRead plan.md twice.\n";
/** The hash of shared/review with SKILL as its one file, as dirhash.Hash1 of golang.org/x/mod computes it. */
export const HASH = "h1:c7yV/uKhC1mA4AQfa0iqY95BjwgtdubuRKOgs06JHx0=";

/** The entry of shared/review of $INPUT at "main". */
export const reviewEntry = (sut: Sut): string => `git+file://${sut.files.path("$INPUT")}#main:shared/review`;

/** Commits shared/review/SKILL.md with `text` in $INPUT and gives the commit. */
export async function committedSkill(sut: Sut, text = SKILL): Promise<string> {
  await sut.files.put("$INPUT/shared/review/SKILL.md", text);
  return sut.git.commit("the skill review");
}

/** The README's factory.yaml whose agent "plan" has the skill `entry`. */
export const factoryWithSkill = (fakes: Fakes, entry: string): string =>
  (readmeFiles(fakes)["factory.yaml"] as string).replace(
    "    prompt: ./agents/plan.md\n",
    `    prompt: ./agents/plan.md\n    skills: ["${entry}"]\n`,
  );

/** Puts factory.lock that pins the skill "review" for `entry` at `commit` with `hash`. */
export const putPin = (sut: Sut, entry: string, commit: string, hash: string): Promise<void> =>
  sut.files.put(
    "$INPUT/factory.lock",
    JSON.stringify({ version: 1, mcp: {}, skills: { review: { source: entry, commit, hash } } }),
  );
