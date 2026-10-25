import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-009", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  await given('a request without "workItem"', async () => {
    await sut.files.put("$INPUT/request.json", JSON.stringify({ stage: "merge", summary: "Merge it" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output names the field "workItem"', async () => {
    expect(run.stderr).toContain('request.json: the field "workItem" must be a text of 1 to 128 characters');
  });
});
