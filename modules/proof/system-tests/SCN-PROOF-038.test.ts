import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { captured, product } from "./capture.ts";

scenario("SCN-PROOF-038", async ({ sut, fakes, given, when, then }) => {
  let site: FakeHttp;
  await given(
    'a running product whose pages "/checkout" and "/receipt" show "Pay with a card" and "Thank you"',
    async () => {
      site = await product(fakes, { "/checkout": "Pay with a card", "/receipt": "Thank you" });
    },
  );

  await given('the developer captured "<product>/checkout" for "SCN-WEB-001"', async () => {
    const first = await sut.cli(["capture", `${site.url}/checkout`, "--scenario", "SCN-WEB-001"]);
    expect(first.exitCode, first.stderr).toBe(0);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof capture <product>/receipt --scenario SCN-WEB-002"', async () => {
    run = await sut.cli(["capture", `${site.url}/receipt`, "--scenario", "SCN-WEB-002"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the capture report lists the scenarios "SCN-WEB-001" and "SCN-WEB-002"', async () => {
    expect((await captured(sut)).map((spec) => spec.title)).toEqual([
      `SCN-WEB-001 ${site.url}/checkout`,
      `SCN-WEB-002 ${site.url}/receipt`,
    ]);
  });
});
