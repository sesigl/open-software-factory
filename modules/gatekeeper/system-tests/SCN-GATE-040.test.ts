import { scenario } from "@opensoftware/testkit";
import { PULL_GATE, putMergeFiles } from "./gate.ts";

scenario("SCN-GATE-040", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given('a forge that answers 404 for the pull request "acme/web#12"', async () => {
    const http = await fakes.http([{ path: "/repos/acme/web/pulls/12", status: 404, body: { message: "Not Found" } }]);
    url = http.url;
    await putMergeFiles(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the pull request', async () => {
    run = await sut.cli(["request", ...PULL_GATE], { env: { GATEKEEPER_FORGE_URL: url } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output says that the forge answered 404 to "GET /repos/acme/web/pulls/12"', async () => {
    expect(run.stderr).toBe("gatekeeper: GET /repos/acme/web/pulls/12: the forge answered 404\n");
  });
});
