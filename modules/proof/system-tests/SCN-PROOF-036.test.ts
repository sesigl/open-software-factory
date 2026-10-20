import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capturedScenario, product } from "./capture.ts";

scenario("SCN-PROOF-036", async ({ sut, fakes, given, when, then }) => {
  let site: FakeHttp;
  await given('a running product whose page "/checkout" shows "Pay with a card"', async () => {
    site = await product(fakes, { "/checkout": "Pay with a card" });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof capture <product>/checkout --scenario SCN-WEB-001 --expect \\"Thank you\\""',
    async () => {
      run = await sut.cli(["capture", `${site.url}/checkout`, "--scenario", "SCN-WEB-001", "--expect", "Thank you"]);
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output contains "SCN-WEB-001: the page does not show \\"Thank you\\""', async () => {
    expect(run.stderr).toContain('SCN-WEB-001: the page does not show "Thank you"');
  });

  await then(
    'the capture report lists "SCN-WEB-001" as "unexpected" with a "screenshot", a "video" and a "trace"',
    async () => {
      expect(await capturedScenario(sut, "SCN-WEB-001")).toEqual({
        status: "unexpected",
        names: ["screenshot", "trace", "video"],
      });
    },
  );
});
