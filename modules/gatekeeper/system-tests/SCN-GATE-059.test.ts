import { scenario } from "@opensoftware/testkit";
import { forgeEnv, PULL_GATE, putMergeFiles } from "./gate.ts";

scenario("SCN-GATE-059", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given(
    'a forge that answers 404 for the pull request "acme/web#12" and for the repository "acme/web"',
    async () => {
      const notFound = { status: 404, body: { message: "Not Found" } };
      const http = await fakes.http([
        { path: "/repos/acme/web/pulls/12", ...notFound },
        { path: "/repos/acme/web", ...notFound },
      ]);
      url = http.url;
      await putMergeFiles(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the pull request', async () => {
    run = await sut.cli(["request", ...PULL_GATE], { env: forgeEnv(sut, url) });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output says that the forge adapter has no repository "acme/web"', async () => {
    expect(run.stderr).toBe("gatekeeper: pr acme/web: forge-github: no repository acme/web\n");
  });
});
