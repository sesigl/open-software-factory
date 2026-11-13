import { isValid } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { prompt } from "./factory.ts";
import { waitingFactory } from "./waits.ts";

scenario("SCN-FSPEC-062", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose stage "verify" has "wait: true" and the checks ["verify"], and no agent "verify"',
    async () => {
      await sut.files.put("$INPUT/factory.yaml", waitingFactory(["wait: true", "checks: [verify]"]));
      await sut.files.put("$INPUT/agents/ship.md", prompt("ship"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory resolve"', async () => {
    run = await sut.cli(["resolve"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the printed definition is a valid factory-definition", async () => {
    expect(isValid("factory-definition", JSON.parse(run.stdout))).toBe(true);
  });

  await then('its stage "verify" has "wait: true" and no agent', async () => {
    expect(JSON.parse(run.stdout).workflow).toEqual([
      { stage: "verify", wait: true, checks: ["verify"] },
      { stage: "ship", agent: "ship" },
    ]);
  });
});
