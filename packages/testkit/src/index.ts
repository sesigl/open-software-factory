// @opensoftware/testkit: the only way system tests touch a module. Layers: see ../architecture.json.
// T-02 adds HTTP, MCP and event handles, the fakes, NOREAL and REACH.
export type { Fakes } from "./fakes/fakes.ts";
export { type ScenarioContext, type StepFn, scenario } from "./scenario.ts";
export type { CliResult } from "./support/process.ts";
export type { Sut } from "./sut/sut.ts";
