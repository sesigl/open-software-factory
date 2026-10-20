import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capturedScenario, product } from "./capture.ts";

scenario("SCN-PROOF-035", async ({ sut, fakes, given, when, then }) => {
  let site: FakeHttp;
  await given('a running product whose page "/checkout" shows "Pay with a card"', async () => {
    site = await product(fakes, { "/checkout": "Pay with a card" });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof capture <product>/checkout --scenario SCN-WEB-001"', async () => {
    run = await sut.cli(["capture", `${site.url}/checkout`, "--scenario", "SCN-WEB-001"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the capture report lists "SCN-WEB-001" as "expected" with a "screenshot", a "video" and a "trace"',
    async () => {
      expect(await capturedScenario(sut, "SCN-WEB-001")).toEqual({
        status: "expected",
        names: ["screenshot", "trace", "video"],
      });
    },
  );

  await then('"$OUTPUT/capture/SCN-WEB-001/page.png" is a PNG image', async () => {
    expect((await sut.files.read("$OUTPUT/capture/SCN-WEB-001/page.png")).slice(1, 4)).toBe("PNG");
  });
});
