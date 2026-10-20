// proof capture: a screenshot, a video and a trace of a page, or the files of a Playwright MCP session, as a
// Playwright JSON report that bundle reads.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { capturePage } from "../adapters/browser.ts";
import { type CaptureFile, type CaptureReport, captureFile, captureSpec, withSpec } from "../domain/capture.ts";

export interface CaptureOptions {
  /** The page to open, or undefined with `from`. */
  url: string | undefined;
  /** A folder of files to take instead of opening a page. */
  from: string | undefined;
  scenario: string | undefined;
  expect: string | undefined;
  out: string;
}

export interface Captured {
  output: string;
  /** The problem that failed the capture, after its files were written. */
  problem?: string;
}

const REPORT = "report.json";

export async function capture(options: CaptureOptions): Promise<Captured> {
  const id = options.scenario;
  if (!id) throw new Error("give the scenario with --scenario");
  const source = options.from ?? options.url;
  if (!source) throw new Error("give the URL of the page, or a folder with --from");
  const folder = join(options.out, id);

  let files: CaptureFile[];
  let problem: string | undefined;
  if (options.from) {
    files = filesOf(options.from);
    if (files.length === 0) throw new Error(`${options.from} has no screenshot, video or trace`);
    rmSync(folder, { recursive: true, force: true });
    for (const file of files) {
      mkdirSync(dirname(join(folder, file.path)), { recursive: true });
      copyFileSync(join(options.from, file.path), join(folder, file.path));
    }
  } else {
    rmSync(folder, { recursive: true, force: true });
    const page = await capturePage(source, folder, options.expect);
    files = ["page.png", "video.webm", "trace.zip"].map((path) => captureFile(path) as CaptureFile);
    if (page.status === undefined || page.status >= 400) problem = `${source} answered ${page.status ?? "nothing"}`;
    else if (!page.shown) problem = `the page does not show "${options.expect}"`;
  }

  const located = files.map((file) => ({ ...file, path: `${id}/${file.path}` }));
  const reportFile = join(options.out, REPORT);
  const earlier = existsSync(reportFile) ? (JSON.parse(readFileSync(reportFile, "utf8")) as CaptureReport) : undefined;
  writeFileSync(
    reportFile,
    `${JSON.stringify(withSpec(earlier, id, captureSpec(id, source, problem === undefined, located)), null, 2)}\n`,
  );
  return {
    output: `captured ${id}: ${problem === undefined ? "passed" : "failed"}, ${files.length} files in ${folder}`,
    ...(problem ? { problem: `${id}: ${problem}` } : {}),
  };
}

/** The screenshots, videos and traces below the folder, with paths relative to it, in order. */
function filesOf(folder: string): CaptureFile[] {
  if (!existsSync(folder)) throw new Error(`${folder} does not exist`);
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : [relative(folder, join(dir, entry.name)).replaceAll("\\", "/")],
    );
  return walk(folder)
    .sort()
    .flatMap((path) => captureFile(path) ?? []);
}
