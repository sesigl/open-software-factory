// The skills of other Git repositories in the scenarios (ADR 0146): $INPUT serves as that repository at a file:// URL,
// with the skill "review" in its folder shared/review.
import type { FactoryLock } from "@opensoftware/contracts";
import type { Sut } from "@opensoftware/testkit";
import { named, putSkill, putSkilled } from "./skills.ts";

/** A skill of a repository that no scenario fetches: an entry that lint reads without the network. */
export const FAR = "git+https://forge.example/acme/skills.git#v1:skills/review";

/** The SKILL.md of "review" in the first commit. */
export const REVIEW = named("review");

/** The entry of shared/review of $INPUT at `ref`. */
export const entryAt = (sut: Sut, ref: string): string => `git+file://${sut.files.path("$INPUT")}#${ref}:shared/review`;

/** Commits shared/review/SKILL.md with `text` in $INPUT and gives the commit. */
export async function committedReview(sut: Sut, text = REVIEW): Promise<string> {
  await putSkill(sut, "shared/review", text);
  return sut.git.commit("the skill review");
}

/** The agent "triage" with the skill entries, quoted, on line 14; returns the text of factory.yaml. */
export const putEntries = (sut: Sut, entries: string[], extra: string[] = []): Promise<string> =>
  putSkilled(
    sut,
    entries.map((entry) => (entry.startsWith("git+") ? `"${entry}"` : entry)),
    extra,
  );

/** factory.lock in the folder of factory.yaml. */
export async function lockOf(sut: Sut): Promise<FactoryLock> {
  return JSON.parse(await sut.files.read("$INPUT/factory.lock")) as FactoryLock;
}

/** The second commit of shared/review: a third line in its body. */
export const NEWER = `${REVIEW}Read it a third time.\n`;
