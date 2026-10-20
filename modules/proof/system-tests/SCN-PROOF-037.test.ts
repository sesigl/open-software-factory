import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { product } from "./capture.ts";

scenario("SCN-PROOF-037", async ({ sut, fakes, given, when, then }) => {
  let site: FakeHttp;
  await given('a running product whose page "/checkout" answers 500', async () => {
    site = await product(fakes, { "/checkout": 500 });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof capture <product>/checkout --scenario SCN-WEB-001"', async () => {
    run = await sut.cli(["capture", `${site.url}/checkout`, "--scenario", "SCN-WEB-001"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output contains "SCN-WEB-001: <product>/checkout answered 500"', async () => {
    expect(run.stderr).toContain(`SCN-WEB-001: ${site.url}/checkout answered 500`);
  });
});
