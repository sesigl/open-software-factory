import { readInputs, UsageError } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-010", async ({ sut, when, then }) => {
  let error: unknown;
  await when('the module reads the input "missing.jsonl"', async () => {
    try {
      readInputs([sut.files.path("$INPUT/missing.jsonl")], /\.jsonl$/);
    } catch (thrown) {
      error = thrown;
    }
  });

  await then('it gets the usage error "<path of $INPUT>/missing.jsonl: no such file or folder"', async () => {
    expect(error).toBeInstanceOf(UsageError);
    expect((error as Error).message).toBe(`${sut.files.path("$INPUT/missing.jsonl")}: no such file or folder`);
  });
});
