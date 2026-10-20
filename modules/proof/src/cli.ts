#!/usr/bin/env node
// proof <command>: the entry layer only parses arguments and calls the commands.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { attach } from "./commands/attach.ts";
import { bundle } from "./commands/bundle.ts";
import { verify } from "./commands/verify.ts";

const HELP = `Usage: proof <command> [options]

Commands:
  bundle --playwright <report.json> --junit <report.xml> [--out <folder>] [--repository <url>] [--commit <sha>] [--pull-request <url>]  Join the tests of Playwright JSON and JUnit XML reports (each repeatable) by scenario ID into an evidence bundle in --out ($OUTPUT/evidence).
  verify <bundle> [--scenario <id>]...  Check the manifest against the evidence-bundle contract and every artifact against its SHA-256, and that each listed scenario (default: each in the bundle) passed with evidence. Exit 1 on any problem.
  attach <bundle> [--pr <url>] [--store s3://<bucket>/<prefix>] [--bundle-url <url>]  Post or update one comment with the scenarios on the pull request and set the commit status "proof". --store uploads the bundle first and links it.
`;

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    playwright: { type: "string", multiple: true },
    junit: { type: "string", multiple: true },
    out: { type: "string" },
    repository: { type: "string" },
    commit: { type: "string" },
    "pull-request": { type: "string" },
    scenario: { type: "string", multiple: true },
    pr: { type: "string" },
    store: { type: "string" },
    "bundle-url": { type: "string" },
  },
});
const [command, folder] = positionals;
const env = process.env;

const commands: Record<string, () => Promise<string>> = {
  bundle: async () =>
    bundle({
      playwright: values.playwright ?? [],
      junit: values.junit ?? [],
      out: values.out ?? join(env.OUTPUT ?? ".", "evidence"),
      repository:
        values.repository ??
        (env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY
          ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}`
          : undefined),
      commit: values.commit,
      pullRequest: values["pull-request"],
      version,
      now: env.OSF_NOW ?? new Date().toISOString(),
      warn: (line) => process.stderr.write(`proof: ${line}\n`),
    }),
  verify: async () => {
    const { lines, ok } = verify(folder as string, values.scenario ?? []);
    if (!ok) process.exitCode = 1;
    return lines.join("\n");
  },
  attach: () =>
    attach(folder as string, {
      pr: values.pr,
      store: values.store,
      bundleUrl: values["bundle-url"],
      forgeUrl: env.PROOF_FORGE_URL,
      token: env.PROOF_FORGE_TOKEN,
      storeConfig: {
        endpoint: env.AWS_ENDPOINT_URL,
        region: env.AWS_REGION ?? "us-east-1",
        accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    }),
};
const ready = command === "bundle" || ((command === "verify" || command === "attach") && folder);
const chosen = ready && !values.help ? commands[command as string] : undefined;

if (chosen) {
  chosen().then(
    (output) => process.stdout.write(`${output}\n`),
    (error: Error) => {
      process.stderr.write(`proof: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
} else {
  (values.help ? process.stdout : process.stderr).write(HELP);
  process.exitCode = values.help ? 0 : 2;
}
