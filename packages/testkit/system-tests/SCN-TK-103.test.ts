import { type Forge, type Issue, scenario } from "@opensoftware/testkit";
import { forgeClient } from "./forge.ts";

scenario("SCN-TK-103", async ({ fakes, given, when, then }) => {
  let forge: Forge;
  let issue: Issue;
  await given(
    'the issue "Export reports as CSV" that the test opened in fakes.forge and gave the label "factory"',
    async () => {
      forge = await fakes.forge();
      await forge.createRepository("demo");
      issue = await forge.openIssue("demo", { title: "Export reports as CSV" });
      await forge.label("demo", issue.number, "factory");
    },
  );

  let read: { number: number; title: string; labels: { name: string }[] };
  await when("a module reads the issue through the forge's API", async () => {
    read = await forgeClient(forge, "demo")("GET", `/issues/${issue.number}`);
  });

  await then('issue 1 has the title "Export reports as CSV" and the one label "factory"', async () => {
    expect({ number: read.number, title: read.title, labels: read.labels.map((label) => label.name) }).toEqual({
      number: 1,
      title: "Export reports as CSV",
      labels: ["factory"],
    });
  });
});
