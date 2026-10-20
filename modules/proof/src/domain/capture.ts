// The capture report: a Playwright JSON report with one spec per captured scenario. No I/O.

/** One file of a capture, at `path` relative to the report's folder. */
export interface CaptureFile {
  name: "screenshot" | "video" | "trace";
  contentType: string;
  path: string;
}

export interface CaptureSpec {
  title: string;
  tags: string[];
  tests: {
    status: "expected" | "unexpected";
    annotations: [];
    results: { status: "passed" | "failed"; attachments: CaptureFile[] }[];
  }[];
}

export interface CaptureReport {
  suites: { title: string; specs: CaptureSpec[] }[];
}

const SUITE = "proof capture";

const FILES: Record<string, Omit<CaptureFile, "path">> = {
  ".png": { name: "screenshot", contentType: "image/png" },
  ".jpg": { name: "screenshot", contentType: "image/jpeg" },
  ".jpeg": { name: "screenshot", contentType: "image/jpeg" },
  ".webm": { name: "video", contentType: "video/webm" },
  ".zip": { name: "trace", contentType: "application/zip" },
};

/** The capture file a path stands for, by its extension, or undefined when it is none. */
export function captureFile(path: string): CaptureFile | undefined {
  const extension = /\.[^./]+$/.exec(path.toLowerCase())?.[0] ?? "";
  const file = FILES[extension];
  return file ? { ...file, path } : undefined;
}

/** The spec of one capture: the scenario ID and what was captured, passed or not, with its files. */
export function captureSpec(id: string, source: string, passed: boolean, files: CaptureFile[]): CaptureSpec {
  return {
    title: `${id} ${source}`,
    tags: [],
    tests: [
      {
        status: passed ? "expected" : "unexpected",
        annotations: [],
        results: [{ status: passed ? "passed" : "failed", attachments: files }],
      },
    ],
  };
}

/** The report with the spec added, in place of an earlier spec of the same scenario. */
export function withSpec(report: CaptureReport | undefined, id: string, spec: CaptureSpec): CaptureReport {
  const specs = (report?.suites.find((suite) => suite.title === SUITE)?.specs ?? []).filter(
    (entry) => !entry.title.startsWith(`${id} `),
  );
  return { suites: [{ title: SUITE, specs: [...specs, spec] }] };
}
