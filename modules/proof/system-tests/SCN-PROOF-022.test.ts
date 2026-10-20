import { scenario } from "@opensoftware/testkit";
import { SHA } from "./reports.ts";

scenario("SCN-PROOF-022", async ({ sut, given, when, then }) => {
  await given('a bundle whose manifest has the scenario ID "WEB-1"', async () => {
    await sut.files.put(
      "$INPUT/evidence/evidence.json",
      JSON.stringify({
        manifestVersion: 1,
        id: "proof-1",
        createdAt: "2026-01-01T00:00:00Z",
        subject: { repository: "https://github.com/acme/web", commit: SHA },
        producer: { name: "proof", version: "0.1.0" },
        result: "passed",
        scenarios: [{ id: "WEB-1", result: "passed", artifacts: [] }],
        artifacts: [],
      }),
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof verify evidence"', async () => {
    run = await sut.cli(["verify", "evidence"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "evidence.json /scenarios/0/id"', async () => {
    expect(run.stdout).toContain("evidence.json /scenarios/0/id");
  });
});
