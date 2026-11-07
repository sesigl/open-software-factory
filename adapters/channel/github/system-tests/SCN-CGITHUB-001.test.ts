import { scenario } from "@opensoftware/testkit";
import { setup } from "./channel.ts";

scenario("SCN-CGITHUB-001", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('an open pull request in "tester/web"', async () => {
    box = await setup(sut, fakes);
  });

  let suffixed: Awaited<ReturnType<typeof box.run>>;
  let prefixed: Awaited<ReturnType<typeof box.run>>;
  await when(
    'the client runs "reply" with "On it" to "github:tester/web:<number>x" and "xgithub:tester/web:<number>"',
    async () => {
      suffixed = await box.run(["reply", `github:tester/web:${box.pr.number}x`, "On it"]);
      prefixed = await box.run(["reply", `xgithub:tester/web:${box.pr.number}`, "On it"]);
    },
  );

  await then(
    'each reply exits with code 2 and the error "channel-github: name the thread as github:<owner>/<repo>:<number>"',
    async () => {
      const error = "channel-github: name the thread as github:<owner>/<repo>:<number>\n";
      expect([suffixed.exitCode, prefixed.exitCode], suffixed.stderr + prefixed.stderr).toEqual([2, 2]);
      expect([suffixed.stderr, prefixed.stderr]).toEqual([error, error]);
    },
  );
});
