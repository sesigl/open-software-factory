import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-039", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  await given("the README policy and request", async () => {
    await putReadme(sut, fakes);
  });

  await given('a groups file "groups.json" with the text "maintainers: slack:U0ADA"', async () => {
    await sut.files.put("$INPUT/groups.json", "maintainers: slack:U0ADA\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "groups.json is not JSON"', async () => {
    expect(run.stderr).toBe("gatekeeper: groups.json is not JSON\n");
  });
});
