import { type Forge, scenario } from "@opensoftware/testkit";
import { forgeClient } from "./forge.ts";

scenario("SCN-TK-080", async ({ fakes, given, when, then }) => {
  let receiver: Awaited<ReturnType<typeof fakes.http>>;
  let forge: Forge;
  await given('a fake for containers and the repository "demo" in fakes.forge', async () => {
    receiver = await fakes.http([{ method: "POST", path: "/forge", body: {} }], { containers: true });
    forge = await fakes.forge();
    await forge.createRepository("demo");
  });

  await when(
    'a module registers a webhook for pull request events of "demo" to the container URL of that fake through the forge\'s API',
    async () => {
      await forgeClient(forge, "demo")("POST", "/hooks", {
        type: "forgejo",
        config: { url: `${receiver.containerUrl}/forge`, content_type: "json" },
        events: ["pull_request"],
        active: true,
      });
    },
  );

  await when("the test opens a pull request in fakes.forge", async () => {
    await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\n" } });
  });

  await then('the fake for containers gets a "pull_request" delivery', async () => {
    const events = () => receiver.headers().map((request) => request.headers["x-forgejo-event"]);
    await expect.poll(events, { timeout: 20_000 }).toContain("pull_request");
    expect(events()).toContain("pull_request");
  });
});
