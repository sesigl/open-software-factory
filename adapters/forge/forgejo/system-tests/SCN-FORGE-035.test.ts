import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-035", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let former = "";
  await given(
    'the branch "console/add-skill" of "tester/web" made from "main", whose "app.js" holds "export const app = 1;"',
    async () => {
      box = await setup(sut, fakes);
      former = String((await box.json(["branch", box.repo, "console/add-skill"])).sha);
    },
  );

  let made: Record<string, unknown>;
  await when(
    "the client runs \"commit tester/web console/add-skill --message 'Add the skill review' app.js=<file> skills/review/SKILL.md=<file>\"",
    async () => {
      await sut.files.put("$INPUT/app.js", "export const app = 2;\n");
      await sut.files.put("$INPUT/SKILL.md", "---\nname: review\n---\n");
      made = await box.json([
        "commit",
        box.repo,
        "console/add-skill",
        "--message",
        "Add the skill review",
        `app.js=${sut.files.path("$INPUT/app.js")}`,
        `skills/review/SKILL.md=${sut.files.path("$INPUT/SKILL.md")}`,
      ]);
    },
  );

  await then("commit prints the SHA of the branch's new head, which is not its former head", async () => {
    const head = (await box.forge.branches("web")).find((each) => each.name === "console/add-skill")?.sha;
    expect(made).toEqual({ sha: head });
    expect(head).not.toBe(former);
  });

  await then(
    'the branch holds both files with the contents of the local files, and "main" still holds the old "app.js"',
    async () => {
      expect(await box.forge.file("web", "app.js", "console/add-skill")).toBe("export const app = 2;\n");
      expect(await box.forge.file("web", "skills/review/SKILL.md", "console/add-skill")).toBe(
        "---\nname: review\n---\n",
      );
      expect(await box.forge.file("web", "app.js", "main")).toBe("export const app = 1;\n");
    },
  );
});
