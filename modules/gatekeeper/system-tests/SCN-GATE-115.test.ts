import { scenario } from "@opensoftware/testkit";
import { forge, forgeEnv, PR, statuses } from "./gate.ts";

const GATED = ["osf/run-7f3a", "observer/research-skill-used-1a2b3c4d", "factory/fix-checkout"];
const OTHER = "claude/todo-t-11-gatekeeper";

scenario("SCN-GATE-115", async ({ sut, fakes, given, when, then }) => {
  await given('the policy and groups of ".github/gatekeeper" of this repository', async () => {
    const files = fakes.fromRepository(".github/gatekeeper");
    await sut.files.put("$INPUT/merge.rego", files["merge.rego"] as string);
    await sut.files.put("$INPUT/groups.json", files["groups.json"] as string);
  });

  const runs: { run: Awaited<ReturnType<typeof sut.cli>>; http: Awaited<ReturnType<typeof forge>> }[] = [];
  await when(
    'the user runs "gatekeeper request" for pull requests from the branches "osf/run-7f3a", "observer/research-skill-used-1a2b3c4d", "factory/fix-checkout" and "claude/todo-t-11-gatekeeper"',
    async () => {
      for (const [index, branch] of [...GATED, OTHER].entries()) {
        const http = await forge(fakes, branch);
        const args = ["request", "--policy", "merge.rego", "--groups", "groups.json", "--pull-request", PR];
        runs.push({ run: await sut.cli([...args, "--out", `gate-${index}.json`], { env: forgeEnv(sut, http) }), http });
      }
    },
  );
  const states = (http: Awaited<ReturnType<typeof forge>>) =>
    statuses(http).map(({ state, description }) => ({ state, description }));

  await then('the first three wait for "maintainers" with the commit status "gatekeeper" "pending"', async () => {
    for (const { run, http } of runs.slice(0, 3)) {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(states(http)).toEqual([{ state: "pending", description: "waiting for maintainers" }]);
    }
  });

  await then('the last passes without a person with the commit status "gatekeeper" "success"', async () => {
    const [last] = runs.slice(3);
    expect(last?.run.exitCode, last?.run.stderr).toBe(0);
    expect(states(last?.http as Awaited<ReturnType<typeof forge>>)).toEqual([
      { state: "success", description: "approved by the policy" },
    ]);
  });
});
