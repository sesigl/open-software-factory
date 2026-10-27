import { scenario } from "@opensoftware/testkit";
import { acpClientModule } from "./module.ts";

scenario("SCN-TK-118", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "push the branch"',
    async () => {
      module = acpClientModule(
        ['When the user runs "demo prompt:push the branch"', 'Then the output is "push the branch: refusal"'],
        [
          "const harness = await fakes.harness([{ when: 'push the branch', commands: ['echo no remote >&2; exit 3'] }]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo prompt:push the branch\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]) };",
          '  run = await sut.cli(["prompt:push the branch"], { env });',
          "});",
          "await then('the output is \"push the branch: refusal\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("push the branch: refusal\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness to run "echo no remote >&2; exit 3" for "push the branch"',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "harness command failed with 3: echo no remote >&2; exit 3"', async () => {
    expect(run.stdout + run.stderr).toContain("harness command failed with 3: echo no remote >&2; exit 3");
  });

  await then('the output contains "no remote"', async () => {
    expect(run.stdout + run.stderr).toMatch(/exit 3\n+no remote/);
  });
});
