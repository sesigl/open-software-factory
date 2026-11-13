// The factory.yaml of the tests of a stage that only waits (ADR 0107): the agent "ship", the forge "github", and the
// stage "verify" with the lines `verify` before the stage "ship".
import { agent, factoryYaml } from "./factory.ts";

export const waitingFactory = (verify: string[]): string =>
  factoryYaml({
    providers: ["harness:", '  claude-code: "^2"', "forge:", '  github: "^0.5"'],
    agents: agent("ship"),
    rest: ["workflow:", "  - stage: verify", ...verify.map((line) => `    ${line}`), "  - stage: ship"],
  });
