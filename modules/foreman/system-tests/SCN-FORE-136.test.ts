import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

/** Every port's adapter at a range of its own, sandboxed agents and the gateway, with the README's prompts. */
const FACTORY = `version: 1
factory: hello
providers:
  harness:
    codex: "^1"
  sandbox:
    docker: "^2"
  forge:
    github: "^0"
  inference:
    litellm: "^3"
inference:
  config: ./inference/litellm.yaml
agents:
  plan:
    harness: codex
    model: routes/default
    effort: medium
    prompt: ./agents/plan.md
    sandbox:
      template: node:24
  implement:
    harness: codex
    model: routes/default
    effort: medium
    prompt: ./agents/implement.md
    sandbox:
      template: node:24
workflow:
  - stage: plan
  - stage: implement
`;

scenario("SCN-FORE-136", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs a factory with "codex" at "^1" under "providers.harness", "docker" at "^2" under "providers.sandbox", "github" at "^0" under "providers.forge" and "litellm" at "^3" under "providers.inference", with no adapter maps and an "npx" that runs the fake adapters',
    async () => {
      server = await serving(sut, fakes, { factory: FACTORY, sandbox: {}, inference: {}, npx: true });
    },
  );

  let answer: Awaited<ReturnType<typeof server.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    answer = await server.start(readmeWork(fakes));
  });

  await then(
    'the answer\'s "adapters" holds each adapter at its range with the command line "npx -y @opensoftware/<port>-<name>@<range>", and "run" after it for the harness',
    async () => {
      expect(answer.response.status, JSON.stringify(answer.error)).toBe(201);
      expect(answer.data?.adapters).toEqual([
        {
          port: "harness",
          name: "codex",
          version: "^1",
          command: ["npx", "-y", "@opensoftware/harness-codex@^1", "run"],
        },
        { port: "sandbox", name: "docker", version: "^2", command: ["npx", "-y", "@opensoftware/sandbox-docker@^2"] },
        { port: "forge", name: "github", version: "^0", command: ["npx", "-y", "@opensoftware/forge-github@^0"] },
        {
          port: "inference",
          name: "litellm",
          version: "^3",
          command: ["npx", "-y", "@opensoftware/inference-litellm@^3"],
        },
      ]);
    },
  );

  await then(
    'the run completes, and "npx" ran "@opensoftware/inference-litellm@^3", "@opensoftware/sandbox-docker@^2" and "@opensoftware/harness-codex@^1 run"',
    async () => {
      const view = await server.until(answer.data?.runId as string, "complete");
      expect(view.stages.map(({ state }) => state)).toEqual(["succeeded", "succeeded"]);
      const calls = (await sut.files.read("$OUTPUT/npx.log")).split("\n");
      expect(calls).toContainEqual(expect.stringMatching(/^-y @opensoftware\/inference-litellm@\^3( |$)/));
      expect(calls).toContainEqual(expect.stringMatching(/^-y @opensoftware\/sandbox-docker@\^2( |$)/));
      expect(calls).toContainEqual("-y @opensoftware/harness-codex@^1 run");
    },
  );
});
