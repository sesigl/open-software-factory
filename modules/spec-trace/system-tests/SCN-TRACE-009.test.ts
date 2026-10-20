import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-009", async ({ sut, given, when, then }) => {
  await given('a repository with the scenario "SCN-SHOP-001"', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=planned")) });
  });

  await given(
    'a Markdown table in "docs/prefixes.md" that registers "SHOP" for "shop/features/" in line 3',
    async () => {
      await sut.files.put(
        "$INPUT/docs/prefixes.md",
        "| Prefix | Owner | Path |\n| --- | --- | --- |\n| SHOP | shop | `shop/features/` |\n",
      );
    },
  );

  await given('a spec-trace.json whose prefixes are "docs/prefixes.md"', async () => {
    await sut.files.put("$INPUT/spec-trace.json", JSON.stringify({ prefixes: "docs/prefixes.md" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only SPEC"', async () => {
    run = await sut.cli(["check", "--only", "SPEC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "SPEC features/checkout.feature:4 prefix SHOP belongs to shop/features/ (docs/prefixes.md:3)"',
    async () => {
      expect(run.stdout).toContain(
        "SPEC features/checkout.feature:4 prefix SHOP belongs to shop/features/ (docs/prefixes.md:3)",
      );
    },
  );
});
