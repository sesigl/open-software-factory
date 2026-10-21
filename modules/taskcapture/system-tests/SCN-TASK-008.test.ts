import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-008", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given('a merged GitHub pull request 7 that changes "src/sum.js" from "a - b" to "a + b" and adds "test/sum.test.js"', async () => {
    pull = await commitPull(sut, {});
    github = await fakes.http([pull.route]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API', async () => {
    run = await capture(sut, github);
  });

  await then('"suite/web-7/solution/files/src/sum.js" holds "a + b"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(await sut.files.read("$OUTPUT/suite/web-7/solution/files/src/sum.js")).toBe("export const sum = (a, b) => a + b;\n");
  });

  await then('"suite/web-7/solution" has no file "files/test/sum.test.js"', async () => {
    expect(await sut.files.list("$OUTPUT/suite/web-7/solution")).not.toContain("files/test/sum.test.js");
  });

  await then('"suite/web-7/solution/solve.sh" copies "/solution/files/." into "/app/"', async () => {
    const script = (await sut.files.read("$OUTPUT/suite/web-7/solution/solve.sh")).split("\n");
    expect(script[0]).toBe("#!/bin/bash");
    expect(script).toContain("cd /app");
    expect(script).toContain("cp -r /solution/files/. /app/");
  });
});
