import { type Input, readInputs } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-009", async ({ sut, given, when, then }) => {
  await given('the file "$INPUT/one.jsonl" with the text "1"', async () => {
    await sut.files.put("$INPUT/one.jsonl", "1");
  });

  await given('the folder "$INPUT/runs" with the files "b/c.jsonl", "a.jsonl" and "notes.md"', async () => {
    await sut.files.put("$INPUT/runs/b/c.jsonl", "c");
    await sut.files.put("$INPUT/runs/a.jsonl", "a");
    await sut.files.put("$INPUT/runs/notes.md", "notes");
  });

  let inputs: Input[];
  await when('the module reads the inputs "one.jsonl" and "runs" with the pattern "\\.jsonl$"', async () => {
    inputs = readInputs([sut.files.path("$INPUT/one.jsonl"), sut.files.path("$INPUT/runs")], /\.jsonl$/);
  });

  await then('it gets "one.jsonl", "runs/a.jsonl" and "runs/b/c.jsonl" in this order, each with its text', async () => {
    expect(inputs).toEqual([
      { file: sut.files.path("$INPUT/one.jsonl"), text: "1" },
      { file: sut.files.path("$INPUT/runs/a.jsonl"), text: "a" },
      { file: sut.files.path("$INPUT/runs/b/c.jsonl"), text: "c" },
    ]);
  });
});
