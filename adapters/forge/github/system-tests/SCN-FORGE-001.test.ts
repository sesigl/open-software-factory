import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-001", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let main: string | undefined;
  await given('the repository "tester/web"', async () => {
    box = await setup(sut, fakes);
    main = (await box.forge.branches("web")).find((branch) => branch.name === "main")?.sha;
  });

  let printed: Record<string, unknown>;
  await when('the client runs "branch tester/web fix-checkout"', async () => {
    printed = await box.json(["branch", "tester/web", "fix-checkout"]);
  });

  await then('the test forge has the branch "fix-checkout" at the head commit of "main"', async () => {
    expect(await box.forge.branches("web")).toEqual([
      { name: "fix-checkout", sha: main },
      { name: "main", sha: main },
    ]);
  });

  await then('branch prints the branch "fix-checkout" with that commit', async () => {
    expect(printed).toEqual({ branch: "fix-checkout", sha: main });
  });
});
