// Shared setup of the scenarios for wrong input: one run of gatekeeper per input file.
import type { Sut } from "@opensoftware/testkit";

export type Run = Awaited<ReturnType<Sut["cli"]>>;

/** The arguments of "gatekeeper request" with these files. */
export const requestArgs = (policy = "policy.rego", groups = "groups.json", request = "request.json"): string[] => [
  "request",
  "--policy",
  policy,
  "--groups",
  groups,
  "--channel",
  "slack:C0GATES",
  request,
];

/** Puts each file into $INPUT: a text as it is, any other value as JSON. */
export async function putEach(sut: Sut, files: Record<string, unknown>): Promise<void> {
  for (const [file, value] of Object.entries(files))
    await sut.files.put(`$INPUT/${file}`, typeof value === "string" ? value : JSON.stringify(value));
}

/** Runs gatekeeper once per item, one after the other, with the arguments for that item. */
export async function runEach(
  sut: Sut,
  items: string[],
  args: (item: string) => string[],
  env: (item: string) => Record<string, string> = () => ({}),
): Promise<Run[]> {
  const runs: Run[] = [];
  for (const item of items) runs.push(await sut.cli(args(item), { env: env(item) }));
  return runs;
}

/** The README request with these fields changed. */
export const readmeRequestWith = (fields: Record<string, unknown>) => ({
  workItem: "https://github.com/acme/web/pull/6",
  stage: "merge",
  summary: "Merge the new checkout flow",
  links: [{ url: "https://github.com/acme/web/pull/6", title: "Pull request" }],
  change: { paths: ["contracts/checkout.tsp"] },
  ...fields,
});

/** The error output of a usage error for each item: gatekeeper's one line. */
export const usageLines = (items: string[], line: (item: string) => string): string[] =>
  items.map((item) => `gatekeeper: ${line(item)}\n`);
