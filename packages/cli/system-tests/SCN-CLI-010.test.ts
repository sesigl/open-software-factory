import { readInputs, UsageError } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-010", async ({ sut, when, then }) => {
  let read: () => unknown;
  await when('the module reads the input "missing.jsonl"', async () => {
    read = () => readInputs([sut.files.path("$INPUT/missing.jsonl")], /\.jsonl$/);
  });

  await then('it gets the usage error "<path of $INPUT>/missing.jsonl: no such file or folder"', async () => {
    expect(read).toThrow(UsageError);
    expect(read).toThrow(`${sut.files.path("$INPUT/missing.jsonl")}: no such file or folder`);
  });
});
