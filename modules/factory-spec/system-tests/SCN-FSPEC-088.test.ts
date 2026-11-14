import { scenario } from "@opensoftware/testkit";
import { putShared, resolved } from "./edit.ts";

const HOST = "evil.example\n      - *sandbox # all: [x]";

scenario("SCN-FSPEC-088", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with comments whose agents "triage", "spec" and "review" share the sandbox of "triage" through the anchor "&sandbox"',
    async () => {
      await putShared(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the console runs "factory edit add-egress spec" with the host "evil.example\\n      - *sandbox # all: [x]"',
    async () => {
      run = await sut.cli(["edit", "add-egress", "spec", HOST]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"factory resolve" of the output gives "spec" the egress hosts "litellm", "github.com" and "evil.example\\n      - *sandbox # all: [x]"',
    async () => {
      const { agents } = await resolved(sut, run);
      expect(agents.spec?.sandbox?.egress).toEqual(["litellm", "github.com", HOST]);
    },
  );
});
