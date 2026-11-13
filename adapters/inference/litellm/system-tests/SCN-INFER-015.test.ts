import { scenario } from "@opensoftware/testkit";
import { call, calls, config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFER-015", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 1);
  const box = gateways(sut);
  try {
    let gateway = { id: "", url: "" };
    await given(
      'a gateway started from a config that routes "routes/triage" to the test provider\'s model "model-c"',
      async () => {
        gateway = await box.start(config(api.containerUrl as string, [{ alias: "routes/triage", model: "model-c" }]));
      },
    );

    let key = "";
    await given('a key for the run "run-7"', async () => {
      key = await box.key(gateway.id, "run-7");
    });

    let first: Awaited<ReturnType<typeof sut.cli>>;
    let second: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client runs "revoke" for the run "run-7" twice', async () => {
      first = await sut.cli(["revoke", gateway.id, "run-7"]);
      second = await sut.cli(["revoke", gateway.id, "run-7"]);
    });

    await then("both exit with code 0", async () => {
      expect([first.exitCode, first.stderr, second.exitCode, second.stderr]).toEqual([0, "", 0, ""]);
    });

    await then('a call of the run to "routes/triage" with its key gets the status 401', async () => {
      const answer = await call(gateway.url, key, { model: "routes/triage" });
      expect(answer.status, JSON.stringify(answer.body)).toBe(401);
    });

    await then("the test provider received no call", async () => {
      expect(calls(api)).toEqual([]);
    });
  } finally {
    await box.stopAll();
  }
});
