import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed, gatewayFactory } from "./foreman.ts";

scenario("SCN-FORE-056", async ({ sut, fakes, given, when, then }) => {
  let adapter = "";
  await given(
    'the README\'s "gateway/factory.yaml" with an inference adapter "litellm" that fails every command with "docker is not running"',
    async () => {
      await committed(sut, fakes, gatewayFactory(fakes));
      const inference = await fakes.inference({ fails: "docker is not running" });
      adapter = [inference.command, ...inference.args].join(" ");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], {
      env: { FOREMAN_API_TOKEN: API_TOKEN, FOREMAN_INFERENCES: JSON.stringify({ litellm: adapter }) },
    });
  });

  await then('the command exits with code 1 and names "docker is not running"', async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toContain("the inference adapter's start failed: docker is not running");
  });
});
