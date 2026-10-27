import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, runOf, SLACK_THREAD, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-016", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a foreman with a run that "Ben" asked for in the Slack thread "https://acme.slack.com/archives/C0WORK/p1767225600000001" and whose pull request is "https://github.com/acme/web/pull/7"',
    async () => {
      const run = runOf("Add diagnostics to cloud agent runs", { pullRequest: "https://github.com/acme/web/pull/7" });
      run.workItem.requester = { kind: "person", id: "slack:U0BEN", displayName: "Ben" };
      api = await foreman(fakes, [run]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when("a person opens the run's page", async () => {
    await serving(sut, [api.url]);
    page = await open(sut, `/runs/${RUN}`);
  });

  await then(
    'the page links the origin "https://acme.slack.com/archives/C0WORK/p1767225600000001" as "slack"',
    async () => {
      expect(links(page.html)).toContainEqual({ href: SLACK_THREAD, text: "slack" });
    },
  );

  await then('the page names the requester "Ben"', async () => {
    expect(text(page.html)).toContain("Origin slack asked by Ben");
  });

  await then('the page links the pull request "https://github.com/acme/web/pull/7"', async () => {
    expect(links(page.html)).toContainEqual({
      href: "https://github.com/acme/web/pull/7",
      text: "https://github.com/acme/web/pull/7",
    });
  });
});
