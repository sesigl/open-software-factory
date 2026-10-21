#!/usr/bin/env node
// proof <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, outputPath, packageVersion, runProgram } from "@opensoftware/cli";
import { attach } from "./commands/attach.ts";
import { bundle } from "./commands/bundle.ts";
import { capture } from "./commands/capture.ts";
import { verify } from "./commands/verify.ts";

const HELP = `Usage: proof <command> [options]

Commands:
  capture <url> --scenario <id> [--expect <text>] [--out <folder>]  Open the page in headless Chromium and keep a screenshot, a video and a trace of it for the scenario in --out ($OUTPUT/capture), with report.json for bundle --playwright. Exit 1 when the page answers 400 or more or does not show --expect.
  capture --from <folder> --scenario <id> [--out <folder>]  Take the screenshots, videos and traces in the folder, for example the --output-dir of Playwright MCP, for the scenario instead.
  bundle --playwright <report.json> --junit <report.xml> [--out <folder>] [--repository <url>] [--commit <sha>] [--pull-request <url>]  Join the tests of Playwright JSON and JUnit XML reports (each repeatable) by scenario ID into an evidence bundle in --out ($OUTPUT/evidence).
  verify <bundle> [--scenario <id>]...  Check the manifest against the evidence-bundle contract and every artifact against its SHA-256, and that each listed scenario (default: each in the bundle) passed with evidence. Exit 1 on any problem.
  attach <bundle> [--pr <url>] [--store s3://<bucket>/<prefix>] [--bundle-url <url>]  Post or update one comment with the scenarios on the pull request and set the commit status "proof". --store uploads the bundle first and links it.
`;

const version = packageVersion(new URL("../package.json", import.meta.url));
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
    from: { type: "string" },
    expect: { type: "string" },
  },
});
const [command, folder] = positionals;
const env = process.env;

const commands: Record<string, Command> = {
  capture: async () => {
    const captured = await capture({
      url: folder,
      from: values.from,
      scenario: values.scenario?.[0],
      expect: values.expect,
      out: outputPath("capture", values.out),
    });
    return { lines: [captured.output], errors: captured.problem ? [captured.problem] : [] };
  },
  bundle: async () => ({
    lines: [
      await bundle({
        playwright: values.playwright ?? [],
        junit: values.junit ?? [],
        out: outputPath("evidence", values.out),
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
    ],
  }),
  verify: async () => {
    const { lines, ok } = verify(folder as string, values.scenario ?? []);
    return { lines, exitCode: ok ? 0 : 1 };
  },
  attach: async () => ({
    lines: [
      await attach(folder as string, {
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
    ],
  }),
};
const ready =
  command === "bundle" || command === "capture" || ((command === "verify" || command === "attach") && folder);
const chosen = ready ? commands[command as string] : undefined;
process.exitCode = await runProgram({ name: "proof", usage: HELP, command: chosen, help: values.help });
