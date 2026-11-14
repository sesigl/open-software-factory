import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-056", async ({ sut, given, when, then }) => {
  const file = sut.files.path("$INPUT/groups.json");
  await given(
    '"CONSOLE_GROUPS" names a groups file whose group "maintainers" has only the example\'s member "slack:U0EXAMPLE" and whose group "leads" has "slack:U0LEO"',
    async () => {
      await sut.files.put(
        "$INPUT/groups.json",
        JSON.stringify({ maintainers: ["slack:U0EXAMPLE"], leads: ["slack:U0LEO"] }),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env: { CONSOLE_GROUPS: file } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'it prints "FAIL  groups: \\"maintainers\\" has no member but the example\'s slack:U0EXAMPLE: put its people in <file>"',
    async () => {
      expect(run.stdout).toContain(
        `FAIL  groups: "maintainers" has no member but the example's slack:U0EXAMPLE: put its people in ${file}\n`,
      );
    },
  );

  await then('it prints no line about the group "leads"', async () => {
    expect(run.stdout).not.toContain("leads");
  });
});
