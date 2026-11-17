// The factory.yaml of the tests of a stage that sends a failed check back (ADR 0165): the agents "plan", "implement"
// and "ship", the forge "github", and the stages "plan", "implement", "verify" that only waits for the check "verify",
// and "ship" with the check "verify". The entry goes on the line below its stage's name.
import { agent, factoryYaml } from "./factory.ts";

const STAGES: [string, string[]][] = [
  ["plan", []],
  ["implement", []],
  ["verify", ["wait: true", "checks: [verify]"]],
  ["ship", ["checks: [verify]"]],
];

export const AGENTS = ["plan", "implement", "ship"];

export const reworkFactory = (stage: string, entry: string): string =>
  factoryYaml({
    providers: ["harness:", '  claude-code: "^2"', "forge:", '  github: "^0.5"'],
    agents: AGENTS.flatMap((name) => agent(name)),
    rest: [
      "workflow:",
      ...STAGES.flatMap(([name, lines]) => [
        `  - stage: ${name}`,
        ...(name === stage ? [entry, ...lines] : lines).map((line) => `    ${line}`),
      ]),
    ],
  });
