// `osf rehearsal factory | run`: the parts of the rehearsal on GitHub (T-95, ADR 0173) that run without Docker. The
// rehearsal runs the six stages of this repository's factory on a scratch repository with the testkit's scripted agent.
//   osf rehearsal factory <dir> --repository <owner/name> --approver <login>
//       writes <dir>/factory/: the factory of deploy/dogfood/factory/ with the same workflow, its agents on the
//       scripted agent (harness acp) without a sandbox, and the approver as the one member of "maintainers"; and
//       <dir>/harness/script.json, the scripted agent's turn for each agent's prompt
//   osf rehearsal run --repository <owner/name> --out <dir> [--issue <n>] [--gate person|token]
//       opens the issue (or labels the one given), hands its "labeled" event to intake as GitHub's webhook would,
//       follows the run's stages at foreman, comments /approve on the pull request with --gate token, and writes
//       <dir>/summary.md and <dir>/run.json
// Both refuse this repository: the rehearsal pushes branches and opens issues and pull requests.
import { createHmac } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GateView, RunView, StageView, WorkItemView } from "@opensoftware/contracts";
import { parse, stringify } from "yaml";

/** The repository whose factory rehearses; the rehearsal never runs on it. */
export const THIS_REPOSITORY = "sesigl/open-software-factory";
const DOGFOOD = "deploy/dogfood/factory";
/** The scripted agent's helper and the change it makes in the scratch repository. */
const AGENT = "deploy/dogfood/rehearsal/agent";
const LABELS = [
  { name: "factory", color: "0e8a16", description: "The factory works on this issue" },
  { name: "rehearsal", color: "c5def5", description: "Made by the factory's rehearsal: close it when you are done" },
];

/** A refusal or a failure that the command prints as one line and exits with. */
class Refused extends Error {
  readonly code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

function repositoryOf(args: string[]): string {
  const repository = option(args, "--repository") ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Refused("give --repository <owner/name>", 2);
  if (repository.toLowerCase() === THIS_REPOSITORY)
    throw new Refused(`${repository} is this repository: the rehearsal runs only on a scratch repository`, 2);
  return repository;
}

export async function rehearsal(root: string, args: string[]): Promise<number> {
  const [command, ...rest] = args;
  try {
    if (command === "factory") return writeFactory(root, rest);
    if (command === "run") return await run(rest);
    console.error(
      "Usage: osf rehearsal factory <dir> --repository <owner/name> --approver <login>\n" +
        "       osf rehearsal run --repository <owner/name> --out <dir> [--issue <n>] [--gate person|token]",
    );
    return 2;
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    console.error(`osf rehearsal: ${error.message}`);
    return error.code;
  }
}

/** The scripted agent's turns for the scratch repository, one per agent of the factory, by agent name. */
function turns(repository: string, files: Record<string, string>) {
  const remote = `https://x-access-token:$GH_TOKEN@github.com/${repository}.git`;
  // Every stage works in the run's folder, named after the run: its branch is the one of the prompt's "Branch:" line.
  const branch = `B="osf/$(basename "$PWD")"`;
  const checkout = `${branch} && cd repo && git fetch -q origin "$B" && git checkout -q -B "$B" FETCH_HEAD`;
  const link = "node rehearsal/github.mjs link";
  const turn = (commands: string[], edits?: Record<string, string>) => ({ ...(edits ? { edits } : {}), commands });
  return {
    triage: turn([`git ls-remote -q "${remote}" HEAD >/dev/null && echo "A task for the rehearsal: greet(name)."`]),
    // The spec stage brings the agent's files into the run's folder, below rehearsal/, for the later stages.
    spec: turn(
      [
        `${branch} && git clone -q "${remote}" repo && cd repo && git checkout -q -b "$B" && mkdir -p features && cp ../rehearsal/greet.feature features/ && git add features && git commit -qm "Specify greet(name)" && git push -q origin "$B"`,
        `${branch} && node rehearsal/github.mjs open ${repository} "$B"`,
      ],
      Object.fromEntries(Object.entries(files).map(([name, text]) => [`rehearsal/${name}`, text])),
    ),
    implement: turn([
      `${checkout} && cp ../rehearsal/greet.js ../rehearsal/greet.test.js . && sed -i 's/@status=planned/@status=implemented/' features/greet.feature && git add -A && git commit -qm "Implement greet(name)" && git push -q origin "$B"`,
      link,
    ]),
    review: turn([`${checkout} && node --test >/dev/null && echo "The tests pass; nothing to change."`, link]),
    ship: turn([
      "node rehearsal/github.mjs ready",
      'echo "The pull request adds greet(name) with its scenario and its test; look at greet.test.js first."',
      link,
    ]),
  } as Record<string, { edits?: Record<string, string>; commands: string[] }>;
}

function copyFolder(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const source = join(from, name);
    if (statSync(source).isDirectory()) copyFolder(source, join(to, name));
    else copyFileSync(source, join(to, name));
  }
}

function writeFactory(root: string, args: string[]): number {
  const dir = args.find((arg, index) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--"));
  const repository = repositoryOf(args);
  const approver = option(args, "--approver") ?? "";
  if (!dir) throw new Refused("give the folder to write the factory into", 2);
  if (!/^[\w-]+$/.test(approver)) throw new Refused("give --approver <GitHub login>", 2);
  const text = readFileSync(join(root, DOGFOOD, "factory.yaml"), "utf8");
  const dogfood = parse(text) as {
    providers: Record<string, unknown>;
    inference?: unknown;
    agents: Record<string, { model: string; effort?: string; prompt: string }>;
  };
  // The workflow as this repository's factory writes it, its comments included.
  const workflow = text.slice(text.search(/^workflow:/m));
  const agentFiles = join(root, AGENT);
  const files = Object.fromEntries(
    readdirSync(agentFiles).map((name) => [name, readFileSync(join(agentFiles, name), "utf8")]),
  );
  const scripted = turns(repository, files);
  const factory = join(dir, "factory");
  copyFolder(join(root, DOGFOOD), factory);
  const agents: Record<string, unknown> = {};
  const script: unknown[] = [];
  for (const [name, agent] of Object.entries(dogfood.agents)) {
    const turn = scripted[name];
    if (!turn) throw new Refused(`the agent ${name} of ${DOGFOOD} has no scripted turn`, 1);
    agents[name] = { harness: "acp", model: agent.model, effort: agent.effort, prompt: agent.prompt };
    // The scripted agent answers a prompt that contains the first line of the agent's prompt file.
    const first = readFileSync(join(root, DOGFOOD, agent.prompt), "utf8").split("\n")[0] ?? "";
    script.push({ when: first, ...turn });
  }
  const { forge, inference } = dogfood.providers;
  const definition = {
    version: 1,
    factory: "rehearsal",
    description: `The rehearsal of the factory of ${THIS_REPOSITORY} on ${repository}, with the scripted agent.`,
    providers: { harness: { acp: "^0" }, forge, ...(inference ? { inference } : {}) },
    ...(dogfood.inference ? { inference: dogfood.inference } : {}),
    agents,
  };
  const header = `# Written by osf rehearsal factory from ${DOGFOOD}/factory.yaml (ADR 0173): the same workflow, its agents on the scripted agent without a sandbox.\n`;
  writeFileSync(join(factory, "factory.yaml"), header + stringify(definition) + workflow);
  writeFileSync(join(factory, "groups.json"), `${JSON.stringify({ maintainers: [`github:${approver}`] })}\n`);
  mkdirSync(join(dir, "harness"), { recursive: true });
  writeFileSync(join(dir, "harness", "script.json"), `${JSON.stringify(script, null, 2)}\n`);
  console.log(`${join(dir, "factory")}\n${join(dir, "harness", "script.json")}`);
  return 0;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Refused(`set ${name}`, 2);
  return value;
}

const wholeNumber = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Refused(`${name} is a whole number of 1 or more`, 2);
  return value;
};

/** A JSON API: GitHub with the rehearsal's token, or a module of the factory with its API token. */
function client(base: string, authorization: string) {
  return async (method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> => {
    const answer = await fetch(`${base}${path}`, {
      method,
      headers: { authorization, accept: "application/json", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await answer.text();
    return { status: answer.status, json: text ? JSON.parse(text) : undefined };
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Issue {
  number: number;
  html_url: string;
  user: { login: string };
}

async function run(args: string[]): Promise<number> {
  const repository = repositoryOf(args);
  const out = option(args, "--out");
  if (!out) throw new Refused("give --out <dir> for the summary", 2);
  const gate = option(args, "--gate") ?? "person";
  if (gate !== "person" && gate !== "token") throw new Refused("--gate is person or token", 2);
  const given = option(args, "--issue");
  const github = client(process.env.GITHUB_API_URL || "https://api.github.com", `Bearer ${env("REHEARSAL_TOKEN")}`);
  const intakeUrl = env("INTAKE_URL");
  const intake = client(intakeUrl, `Bearer ${env("INTAKE_API_TOKEN")}`);
  const secret = env("INTAKE_WEBHOOK_SECRET");
  const foreman = client(env("FOREMAN_URL"), `Bearer ${env("FOREMAN_API_TOKEN")}`);
  const gatekeeper = client(env("GATEKEEPER_URL"), `Bearer ${env("GATEKEEPER_API_TOKEN")}`);
  const waitMs = wholeNumber("REHEARSAL_WAIT_MS", 3_600_000);
  const pollMs = wholeNumber("REHEARSAL_POLL_MS", 5000);
  const must = async (what: string, call: Promise<{ status: number; json: unknown }>, ok = [200, 201]) => {
    const answer = await call;
    if (!ok.includes(answer.status))
      throw new Refused(`${what} answered ${answer.status}: ${JSON.stringify(answer.json)}`, 1);
    return answer.json;
  };

  const lines: string[] = [`# Rehearsal on ${repository}`, ""];
  const facts: [string, string][] = [];
  let view: RunView | undefined;
  const finish = (failure?: string): number => {
    mkdirSync(out, { recursive: true });
    const rows = (view?.stages ?? []).map(
      (stage) => `| ${stage.stage} | ${stage.state} | ${(stage.reason ?? stage.note ?? "").replaceAll("|", "\\|")} |`,
    );
    const summary = [
      ...lines,
      failure ? `**Failed:** ${failure}` : "**Passed:** every stage succeeded.",
      "",
      "| | |",
      "| --- | --- |",
      ...facts.map(([name, value]) => `| ${name} | ${value} |`),
      "",
      ...(rows.length > 0 ? ["| Stage | State | Reason or note |", "| --- | --- | --- |", ...rows, ""] : []),
      `What the rehearsal leaves on ${repository} is labeled \`rehearsal\`: the issue, the pull request and its branch \`osf/<run ID>\`. Close the pull request with its branch and the issue when you are done.`,
      "",
    ].join("\n");
    writeFileSync(join(out, "summary.md"), summary);
    if (view) writeFileSync(join(out, "run.json"), `${JSON.stringify(view, null, 2)}\n`);
    if (failure) console.error(`osf rehearsal: ${failure}`);
    else console.log(`The rehearsal passed: ${view?.pullRequest}`);
    return failure ? 1 : 0;
  };

  try {
    for (const label of LABELS)
      await must(
        `GitHub's POST /repos/${repository}/labels`,
        github("POST", `/repos/${repository}/labels`, label),
        [201, 422],
      );
    let issue: Issue;
    if (given) {
      await must(
        "GitHub's labels of the issue",
        github("POST", `/repos/${repository}/issues/${given}/labels`, { labels: LABELS.map(({ name }) => name) }),
      );
      issue = (await must("GitHub's issue", github("GET", `/repos/${repository}/issues/${given}`))) as Issue;
    } else {
      const body = {
        title: "Rehearsal: greet(name)",
        body: "Add `greet(name)`, which returns `Hello, <name>!`, with its scenario and its test. Opened by the factory's rehearsal (ADR 0173): close it when you are done.",
        labels: LABELS.map(({ name }) => name),
      };
      issue = (await must("GitHub's new issue", github("POST", `/repos/${repository}/issues`, body))) as Issue;
    }
    facts.push(["Issue", issue.html_url]);
    console.log(`Issue: ${issue.html_url}`);

    // The delivery that GitHub sends for the label "factory", as a relay like smee.io forwards it to intake.
    const delivery = JSON.stringify({
      action: "labeled",
      issue,
      label: { name: "factory" },
      repository: { full_name: repository, html_url: issue.html_url.replace(/\/issues\/\d+$/, "") },
      sender: issue.user,
    });
    const signature = `sha256=${createHmac("sha256", secret).update(delivery).digest("hex")}`;
    const relayed = await fetch(`${intakeUrl}/forge/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-github-delivery": `rehearsal-${issue.number}`,
        "x-hub-signature-256": signature,
      },
      body: delivery,
    });
    if (!relayed.ok) return finish(`intake answered the issue's event with ${relayed.status}: ${await relayed.text()}`);

    const deadline = Date.now() + waitMs;
    let item: WorkItemView | undefined;
    while (!item?.runId) {
      if (Date.now() > deadline) return finish(`intake started no run of the issue within ${waitMs} ms`);
      const answer = await intake("GET", `/v1/work-items?dedupeKey=${encodeURIComponent(issue.html_url)}`);
      if (answer.status === 200) item = answer.json as WorkItemView;
      if (!item?.runId) await sleep(pollMs);
    }
    facts.push(["Work item", item.workItem.id ?? ""], ["Run", item.runId]);
    console.log(`Run: ${item.runId}`);

    const seen = new Map<string, string>();
    let approved = false;
    for (;;) {
      view = (await must("foreman's run", foreman("GET", `/v1/runs/${item.runId}`))) as RunView;
      for (const stage of view.stages) {
        if (seen.get(stage.stage) !== stage.state) console.log(`The stage ${stage.stage} is ${stage.state}.`);
        seen.set(stage.stage, stage.state);
      }
      const atGate = view.stages.find((stage) => stage.state === "blocked" && stage.gateId);
      if (atGate && view.pullRequest && !approved) {
        approved = true;
        if (gate === "token") {
          const number = view.pullRequest.split("/").pop();
          await must(
            "GitHub's comment",
            github("POST", `/repos/${repository}/issues/${number}/comments`, { body: "/approve" }),
          );
          console.log(`Commented /approve on ${view.pullRequest} with REHEARSAL_TOKEN.`);
        } else {
          console.log(
            `The gate before the stage ${atGate.stage} waits: comment /approve on ${view.pullRequest} as a member of maintainers.`,
          );
        }
      }
      if (view.state === "complete") break;
      if (view.state === "failed" || view.state === "cancelled") {
        const failed = view.stages.find((stage) => ["failed", "rejected", "cancelled"].includes(stage.state));
        return finish(
          failed
            ? `the stage ${failed.stage} ${failed.state}: ${failed.reason ?? "no reason"}`
            : `the run ${view.state}`,
        );
      }
      if (Date.now() > deadline) {
        const open = view.stages.find((stage) => stage.state !== "succeeded") as StageView;
        const where = open.state === "blocked" && open.gateId ? " at its gate" : "";
        return finish(`the stage ${open.stage} did not end within ${waitMs} ms: it is ${open.state}${where}`);
      }
      await sleep(pollMs);
    }

    const gated = view.stages.find((stage) => stage.gateId);
    if (gated?.gateId) {
      const record = ((await must("gatekeeper's gate", gatekeeper("GET", `/v1/gates/${gated.gateId}`))) as GateView)
        .record;
      const how = gate === "token" ? "answered with REHEARSAL_TOKEN by the workflow, not by a person" : "on GitHub";
      facts.push([`Gate before ${gated.stage}`, `${record?.decision} by ${record?.decidedBy?.id} (${how})`]);
    }
    const number = view.pullRequest?.split("/").pop();
    const pull = (await must("GitHub's pull request", github("GET", `/repos/${repository}/pulls/${number}`))) as {
      draft: boolean;
      merged: boolean;
    };
    const state = pull.merged ? "merged" : pull.draft ? "draft" : "ready for review";
    facts.push(["Pull request", `${view.pullRequest} (${state})`]);
    return finish(state === "draft" ? `the run completed, but ${view.pullRequest} is still a draft` : undefined);
  } catch (error) {
    if (error instanceof Refused) return finish(error.message);
    throw error;
  }
}
