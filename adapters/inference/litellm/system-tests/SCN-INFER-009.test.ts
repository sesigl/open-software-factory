import { scenario } from "@opensoftware/testkit";
import { config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFER-009", async ({ sut, fakes, given, when, then }) => {
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

    let stop: Awaited<ReturnType<typeof sut.cli>>;
    await when("the client stops the gateway", async () => {
      stop = await sut.cli(["stop", gateway.id]);
    });

    await then("list does not print the gateway's ID", async () => {
      expect(stop.exitCode, stop.stderr).toBe(0);
      const list = await sut.cli(["list"]);
      expect(list.exitCode).toBe(0);
      expect(list.stdout.split("\n")).not.toContain(gateway.id);
    });

    await then('spend-log for the gateway\'s ID exits with code 1 with the error "no gateway" and the ID', async () => {
      const log = await sut.cli(["spend-log", gateway.id]);
      expect(log.exitCode).toBe(1);
      expect(log.stderr).toContain(`no gateway ${gateway.id}`);
    });
  } finally {
    await box.stopAll();
  }
});
