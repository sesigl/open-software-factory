#!/usr/bin/env node
// factory <command>: the entry layer only parses arguments, calls a command and prints its result.
import { parseArgs } from "node:util";
import { outputFolder } from "./adapters/files.ts";

const HELP = `factory: one factory.yaml rendered for every harness, with lint, plan, apply and drift.

Commands:
  factory lint                                    Check factory.yaml; print each problem with its file, line and column.
  factory render [--agent <name>] [--harness <name>]   Write AGENTS.md, the MCP servers and the skill links of one agent to $OUTPUT. --harness all writes every declared harness.
  factory render --k8s                            Write the kagent and agent-sandbox resources of every agent to $OUTPUT/k8s/.
  factory render --gh-aw                          Write one gh-aw workflow per GitHub automation to $OUTPUT/.github/workflows/.
  factory plan                                    Pin registry MCP servers in factory.lock; show what apply changes and what drifted, webhooks included.
  factory apply [--agent <name>] [--harness <name>] [--k8s | --gh-aw]   Render like render, register the forge webhooks and record the applied version in OSF_DATA.
  factory diff <old> [<new>]                      Show the changes between two versions of factory.yaml, as files or Git revisions.
  factory resolve                                 Print the resolved definition as JSON: defaults filled in, registry servers pinned.

Options:
  --file <path>   The factory definition. Default factory.yaml.
  --help          Print this help.
`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      file: { type: "string", default: "factory.yaml" },
      agent: { type: "string" },
      harness: { type: "string" },
      k8s: { type: "boolean" },
      "gh-aw": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  const [command = "", ...rest] = positionals;
  const file = values.file as string;
  const options = { agent: values.agent, harness: values.harness, k8s: values.k8s, ghAw: values["gh-aw"] };
  const print = (lines: string[]): void => void process.stdout.write(`${lines.join("\n")}\n`);

  const commands: Record<string, () => Promise<number>> = {
    async lint() {
      const { problems } = (await import("./commands/load.ts")).lintFile(file);
      print(problems.length > 0 ? [...problems, `${file}: ${problems.length} problems`] : [`${file}: no problems`]);
      return problems.length > 0 ? 1 : 0;
    },
    async render() {
      const [{ load }, { render }] = await Promise.all([import("./commands/load.ts"), import("./commands/render.ts")]);
      print(Object.keys(render(load(file), outputFolder(), options)).map((path) => `wrote ${path}`));
      return 0;
    },
    async plan() {
      const [{ load }, { plan }] = await Promise.all([import("./commands/load.ts"), import("./commands/plan.ts")]);
      print(await plan(load(file), outputFolder()));
      return 0;
    },
    async apply() {
      const [{ load }, { apply }] = await Promise.all([import("./commands/load.ts"), import("./commands/plan.ts")]);
      print(await apply(load(file), outputFolder(), options));
      return 0;
    },
    async diff() {
      print((await import("./commands/diff.ts")).diffVersions(rest[0] ?? "", rest[1] ?? file));
      return 0;
    },
    async resolve() {
      print([JSON.stringify((await import("./index.ts")).resolveFactory(file), null, 2)]);
      return 0;
    },
  };

  const run = commands[command];
  if (!run || values.help) {
    process.stdout.write(HELP);
    return values.help ? 0 : 2;
  }
  return run();
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
