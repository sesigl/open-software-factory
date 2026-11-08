import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme } from "./gate.ts";
import { type Run, readmeRequestWith } from "./input.ts";

scenario("SCN-GATE-073", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  await given('a request whose "summary" is three spaces', async () => {
    await sut.files.put("$INPUT/request.json", JSON.stringify(readmeRequestWith({ summary: "   " })));
  });

  let run: Run;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(`the error output says 'request.json: the field "summary" must say what to approve'`, async () => {
    expect(run.stderr).toBe('gatekeeper: request.json: the field "summary" must say what to approve\n');
  });
});
