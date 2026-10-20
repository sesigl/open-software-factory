import { scenario } from "@opensoftware/testkit";
import { putJunit } from "./action.ts";

scenario("SCN-PROOF-046", async ({ sut, given, when, then }) => {
  await given('a JUnit report "reports/web.xml" where "SCN-WEB-001" passed', async () => {
    await putJunit(sut, ["SCN-WEB-001"]);
    await sut.git.commit("init");
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when('a push workflow of "acme/web" runs the action with "junit: reports/*.xml"', async () => {
    run = await sut.action({ junit: "reports/*.xml" }, { repository: "acme/web" });
  });

  await then("the action succeeds", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "SCN-WEB-001 passed with 1 artifact"', async () => {
    expect(run.stdout).toContain("SCN-WEB-001 passed with 1 artifact");
  });

  await then('the action names the bundle in its output "bundle"', async () => {
    expect(run.outputs.bundle).toMatch(/\/proof\/evidence$/);
  });
});
