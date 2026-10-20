// What verify says about a bundle and what attach writes on a pull request. No I/O.
import type { EvidenceManifest } from "@opensoftware/contracts";

/** The marker that finds proof's own comment on a pull request. */
export const MARKER = "<!-- proof -->";

/** One line per scenario that `verify` checks, and whether each is a problem. */
export function judge(manifest: EvidenceManifest, required: string[]): { line: string; problem: boolean }[] {
  const ids = required.length > 0 ? required : manifest.scenarios.map((scenario) => scenario.id);
  return ids.map((id) => {
    const scenario = manifest.scenarios.find((entry) => entry.id === id);
    if (!scenario || scenario.artifacts.length === 0) return { line: `${id} has no evidence`, problem: true };
    if (scenario.result === "failed") return { line: `${id} failed`, problem: true };
    if (scenario.result === "skipped") return { line: `${id} was skipped`, problem: true };
    const count = scenario.artifacts.length;
    return { line: `${id} passed with ${count} ${count === 1 ? "artifact" : "artifacts"}`, problem: false };
  });
}

/** `<n> of <m> scenarios passed`: the description of the commit status. */
export function summary(manifest: EvidenceManifest): string {
  const passed = manifest.scenarios.filter((scenario) => scenario.result === "passed").length;
  return `${passed} of ${manifest.scenarios.length} scenarios passed`;
}

/** The pull request comment: the result, a link to the bundle and one row per scenario. */
export function comment(manifest: EvidenceManifest, link: string | undefined): string {
  const files = (paths: string[]): string => paths.map((path) => `\`${path.split("/").pop()}\``).join(", ");
  return [
    MARKER,
    `### proof: ${manifest.result}`,
    "",
    `${summary(manifest)} for ${manifest.subject.commit}. Evidence bundle: ${
      link ? `[${manifest.id}](${link})` : `${manifest.id} (not uploaded)`
    }`,
    "",
    "| Scenario | Result | Evidence |",
    "| --- | --- | --- |",
    ...manifest.scenarios.map((scenario) => `| ${scenario.id} | ${scenario.result} | ${files(scenario.artifacts)} |`),
    "",
  ].join("\n");
}

export interface PullRequest {
  forge: "github" | "forgejo";
  origin: string;
  owner: string;
  repository: string;
  number: number;
}

/** A GitHub (`/pull/<n>`) or Forgejo (`/pulls/<n>`) pull request URL. */
export function pullRequestOf(url: string): PullRequest {
  const match = /^(https?:\/\/[^/]+)\/([^/]+)\/([^/]+)\/(pull|pulls)\/(\d+)\/?$/.exec(url);
  if (!match) throw new Error(`not a GitHub or Forgejo pull request URL: ${url}`);
  const [, origin, owner, repository, kind, number] = match as unknown as string[];
  return {
    forge: kind === "pull" ? "github" : "forgejo",
    origin: origin as string,
    owner: owner as string,
    repository: repository as string,
    number: Number(number),
  };
}
