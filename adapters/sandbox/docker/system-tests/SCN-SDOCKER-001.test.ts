import { scenario } from "@opensoftware/testkit";
import { TEMPLATE } from "./sandbox.ts";

scenario("SCN-SDOCKER-001", async ({ sut, given, when, then }) => {
  await given('a sandbox spec with the CPU "four"', async () => {
    await sut.files.put("$INPUT/spec.json", JSON.stringify({ template: TEMPLATE, cpu: "four" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sut.cli(["create", "spec.json"]);
  });

  await then('create exits with code 2 and names "/cpu" as invalid', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain("sandbox-docker: spec.json: /cpu must be number");
  });
});
