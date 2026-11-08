import { scenario } from "@opensoftware/testkit";
import { config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFLITE-017", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 0);
  const box = gateways(sut);
  const routes = [{ alias: "routes/triage", model: "ft:triage-2026-10" }];
  try {
    let first = { id: "", url: "" };
    await given('a gateway started with "OSF_INFERENCE_OWNER" set to a process that ended', async () => {
      // No process has this ID: it is above the highest process ID of Linux and macOS.
      first = await box.start(config(api.containerUrl as string, routes), { OSF_INFERENCE_OWNER: "99999999" });
    });

    let second = { id: "", url: "" };
    await when(
      'a second gateway starts with "OSF_INFERENCE_OWNER" set to a process that runs and "OSF_INFERENCE_ORPHAN_AGE" set to "0"',
      async () => {
        second = await box.start(config(api.containerUrl as string, routes), {
          OSF_INFERENCE_OWNER: String(process.pid),
          OSF_INFERENCE_ORPHAN_AGE: "0",
        });
      },
    );

    await then('"list" prints the second gateway and not the first', async () => {
      const listed = (await sut.cli(["list"])).stdout.split("\n");
      expect(listed).toContain(second.id);
      expect(listed).not.toContain(first.id);
    });
  } finally {
    await box.stopAll();
  }
});
