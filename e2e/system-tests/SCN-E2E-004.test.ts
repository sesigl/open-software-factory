import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { factoryYaml, fromContainer, LITELLM_KEY, type Smoke, smoke, workFolder } from "./profile.ts";

/** A Node repository whose sum subtracts; each pull request fixes one function and adds its test. */
const REPOSITORY = {
  "package.json": `${JSON.stringify({ name: "web", type: "module", scripts: { test: "node --test" } })}\n`,
  "src/math.js": "export const sum = (a, b) => a - b;\n",
};
const FIXES = [1, 2, 3].map((n) => ({
  branch: `fix-${n}`,
  title: `Fix case ${n}`,
  files: {
    [`src/case-${n}.js`]: `export const value = ${n};\n`,
    [`test/case-${n}.test.js`]: `import { test } from "node:test";\ntest("case ${n}", () => {});\n`,
  },
}));

/**
 * A scripted stand-in for the harbor CLI: for each task of the suite and each model it asks the model gateway at
 * E2E_MODEL_URL to solve the task and writes the trial result the way `harbor run` writes it. The answer "solved"
 * gives the reward 1; the cost is one USD per 1000 tokens of the answer's usage.
 */
const HARBOR = `
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
const values = (flag) => args.flatMap((arg, i) => (arg === flag ? [args[i + 1]] : []));
const [suite] = values("--path");
const [agent] = values("--agent");
const [job] = values("--job-name");
const [jobs] = values("--jobs-dir");
const tasks = readdirSync(suite).filter((task) => existsSync(join(suite, task, "task.toml")));
mkdirSync(join(jobs, job), { recursive: true });
writeFileSync(join(jobs, job, "result.json"), JSON.stringify({ id: job }));
for (const task of tasks)
  for (const model of values("--model")) {
    const answer = await fetch(process.env.E2E_MODEL_URL + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: model + " solves " + task }] }),
    }).then((response) => response.json());
    const trial = task + "__" + model.replaceAll("/", "-");
    mkdirSync(join(jobs, job, trial), { recursive: true });
    writeFileSync(join(jobs, job, trial, "result.json"), JSON.stringify({
      task_name: task,
      trial_name: trial,
      agent_info: { name: agent, version: "1.0.0", model_info: { name: model, provider: null } },
      agent_result: { cost_usd: answer.usage.total_tokens / 1000 },
      verifier_result: { rewards: { reward: answer.choices[0].message.content === "solved" ? 1 : 0 } },
      exception_info: null,
    }));
  }
`;

scenario("SCN-E2E-004", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  const repository = `${fromContainer(forge.url)}/${forge.owner}/web`;
  let work = "";
  await given("a benchmark suite with 3 tasks captured from merged pull requests", async () => {
    await forge.createRepository("web", REPOSITORY);
    // The LLM gateway's config of the profile, which route adds its rule to.
    const [config] = Object.values(fakes.fromRepository("deploy/compose/litellm"));
    work = await workFolder(sut, { "harbor.mjs": HARBOR, "litellm.yaml": config as string });
  });

  let gateway: ModelGateway;
  let profile: Smoke;
  await given("the scripted model gateway answers as two models with different cost and correctness", async () => {
    gateway = await fakes.modelGateway(
      [
        // The cheap model fails one task and answers with a tenth of the strong model's tokens.
        { when: "openai/cheap solves web-3", reply: "failed", usage: { prompt_tokens: 50, completion_tokens: 50 } },
        { when: "openai/cheap solves", reply: "solved", usage: { prompt_tokens: 50, completion_tokens: 50 } },
        { when: "openai/strong solves", reply: "solved", usage: { prompt_tokens: 500, completion_tokens: 500 } },
        // The call through the LLM gateway once it routes the tag.
        { when: "Fix the button", reply: "done" },
      ],
      { containers: true },
    );
    profile = await smoke(sut, fakes, factoryYaml(["implement"]), [], forge, {
      E2E_WORK_DIR: work,
      E2E_MODEL_URL: gateway.containerUrl as string,
      E2E_HARBOR: "node /work/harbor.mjs",
      E2E_LITELLM_CONFIG: `${work}/litellm-config.yaml`,
    });
    for (const fix of FIXES) await forge.mergePullRequest(await forge.openPullRequest("web", fix));
    for (const number of [1, 2, 3])
      await profile.run(["run", "--rm", "taskcapture", "capture", `${repository}/pulls/${number}`]);
    const suite = await sut.files.list("$INPUT/work/suite");
    expect(new Set(suite.map((path) => path.split("/")[0]))).toEqual(
      new Set(["web-1", "web-2", "web-3", "prompt-injection"]),
    );
  });

  await when("the factory engineer runs the benchmark and accepts the cheaper model", async () => {
    const models = ["--model", "openai/strong", "--model", "openai/cheap"];
    await profile.run(["run", "--rm", "taskcapture", "run", "--agent", "claude-code", ...models]);
    // The most efficient model is the one route picks without "--model" or "--min-correctness".
    await profile.run([
      "run",
      "--rm",
      "taskcapture",
      "route",
      "--tag",
      "front-end",
      "--alias",
      "coder",
      "--config",
      "litellm.yaml",
      "report.json",
    ]);
  });

  await then("the LLM gateway configuration routes those tasks to the cheaper model", async () => {
    await profile.run(["up", "--detach", "--wait", "litellm"]);
    const answer = await fetch(`${await profile.url("litellm")}/v1/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${LITELLM_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "coder",
        tags: ["front-end"],
        messages: [{ role: "user", content: "Fix the button" }],
      }),
    });
    expect(answer.status, await answer.clone().text()).toBe(200);
    expect(JSON.parse(gateway.calls.at(-1)?.body as string)).toMatchObject({ model: "cheap" });
  });
});
