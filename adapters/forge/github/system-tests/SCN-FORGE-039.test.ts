import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-039", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given(
    '"main" of "tester/web" requires the checks "factory" and "verify" and one approval, and "dev" requires nothing',
    async () => {
      box = await setup(sut, fakes);
      await box.json(["protect", box.repo, "main", "--check", "factory", "--check", "verify", "--approvals", "1"]);
      await box.forge.createBranch("web", { branch: "dev", files: { "dev.md": "dev\n" } });
    },
  );

  let main: Record<string, unknown>;
  let dev: Record<string, unknown>;
  await when('the client runs "rules tester/web main" and "rules tester/web dev"', async () => {
    main = await box.json(["rules", box.repo, "main"]);
    dev = await box.json(["rules", box.repo, "dev"]);
  });

  await then('the first prints the checks "factory" and "verify" and the approvals 1', async () => {
    expect(main).toEqual({ checks: ["factory", "verify"], approvals: 1 });
  });

  await then("the second prints no checks and the approvals 0", async () => {
    expect(dev).toEqual({ checks: [], approvals: 0 });
  });
});
