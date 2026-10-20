// A workflow run of the GitHub Action: its JUnit report and its pull request event.
import type { Sut } from "@opensoftware/testkit";
import { junitReport, PR, SHA } from "./reports.ts";

/** $INPUT/reports/web.xml with one passed test case per ID in `passed` and one failed per ID in `failed`. */
export async function putJunit(sut: Sut, passed: string[], failed: string[] = []): Promise<void> {
  await sut.files.put(
    "$INPUT/reports/web.xml",
    junitReport([
      ...passed.map((id) => ({ name: `${id} works`, scenario: id })),
      ...failed.map((id) => ({ name: `${id} works`, scenario: id, result: "failure" as const })),
    ]),
  );
}

/** The pull_request event of acme/web#7 at SHA. */
export const PULL_REQUEST_EVENT = { pull_request: { number: 7, html_url: PR, head: { sha: SHA } } };
