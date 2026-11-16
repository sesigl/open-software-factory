// The workbench of the island scenarios (ADR 0152): the static folder that the package's build writes, served with the
// console's Content-Security-Policy, and its pages opened in Chromium with the browser's clock paused.
import type { BrowserPage, scenario } from "@opensoftware/testkit";

type Sut = Parameters<Parameters<typeof scenario>[1]>[0]["sut"];

/** The console's Content-Security-Policy from its first island: scripts only from its own files. */
export const POLICY =
  "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

/** The testkit's clock, at which the browser's clock stays until a scenario runs it on. */
const CLOCK = new Date("2026-01-01T00:00:00Z");

/** Serves the built workbench with the console's policy. */
export const serveWorkbench = (sut: Sut) =>
  sut.site.serve("dist/workbench", { headers: { "Content-Security-Policy": POLICY } });

/**
 * Pauses the page's clock: its timers run only when the scenario runs the clock with `page.clock.runFor`. Playwright's
 * actions wait for animation frames, which a paused clock holds back, so a scenario types before it pauses.
 */
export const pause = (page: BrowserPage) => page.clock.pauseAt(CLOCK);

/**
 * Opens a page of the workbench with its clock paused from before its first script, so the island's timer is due
 * exactly `interval` milliseconds of `page.clock.runFor` later.
 */
export const openPaused = (sut: Sut, path: string): Promise<BrowserPage> => sut.browser.open(path, { clock: "paused" });
