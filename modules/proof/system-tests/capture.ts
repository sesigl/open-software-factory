// A running product to capture, and the capture report proof writes.
import type { FakeHttp, Fakes, Sut } from "@opensoftware/testkit";

/** A product that serves each page as HTML with its text in a heading; a number answers with that status. */
export function product(fakes: Fakes, pages: Record<string, string | number>): Promise<FakeHttp> {
  return fakes.http([
    ...Object.entries(pages).map(([path, page]) =>
      typeof page === "number"
        ? { path, status: page, contentType: "text/html", body: "<h1>Internal error</h1>" }
        : { path, contentType: "text/html", body: `<!doctype html><title>${page}</title><h1>${page}</h1>` },
    ),
    // Chromium asks for an icon of every page it opens.
    { path: "/favicon.ico", status: 404, contentType: "text/plain", body: "" },
  ]);
}

export interface CapturedSpec {
  title: string;
  status: string;
  attachments: { name: string; contentType: string; path: string }[];
}

/** The specs of the capture report in a folder below $INPUT or $OUTPUT. */
export async function captured(sut: Sut, folder = "$OUTPUT/capture"): Promise<CapturedSpec[]> {
  const report = JSON.parse(await sut.files.read(`${folder}/report.json`)) as {
    suites: {
      specs: {
        title: string;
        tests: { status: string; results: { attachments: CapturedSpec["attachments"] }[] }[];
      }[];
    }[];
  };
  return report.suites.flatMap((suite) =>
    suite.specs.map((spec) => ({
      title: spec.title,
      status: spec.tests[0]?.status ?? "",
      attachments: spec.tests[0]?.results.flatMap((result) => result.attachments) ?? [],
    })),
  );
}

/** The spec of one scenario, with the names of its attachments. */
export async function capturedScenario(sut: Sut, id: string): Promise<{ status: string; names: string[] }> {
  const spec = (await captured(sut)).find((entry) => entry.title.startsWith(`${id} `));
  return { status: spec?.status ?? "missing", names: (spec?.attachments ?? []).map((entry) => entry.name).sort() };
}
