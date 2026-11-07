import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { expectUsageErrors, putEach, type Run, readmeRequestWith, requestArgs, runEach } from "./input.ts";

const FILES = {
  "text.json": readmeRequestWith({ links: "https://github.com/acme/web/pull/6" }),
  "title.json": readmeRequestWith({ links: [{ title: "Pull request" }] }),
  "null.json": readmeRequestWith({ links: [null] }),
};

scenario("SCN-GATE-074", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and groups", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    'the requests "text.json" with a text as links, "title.json" with a link without a URL and "null.json" with the link null',
    async () => {
      await putEach(sut, FILES);
    },
  );

  let runs: Run[] = [];
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES" with each request', async () => {
    runs = await runEach(sut, Object.keys(FILES), (file) => requestArgs("policy.rego", "groups.json", file));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2]);
  });

  await then(
    'each error output says that the field "links" of the request file must be a list of { url, title }',
    async () => {
      expectUsageErrors(
        runs,
        Object.keys(FILES),
        (file) => `${file}: the field "links" must be a list of { url, title }`,
      );
    },
  );
});
