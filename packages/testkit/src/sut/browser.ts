// sut.browser: the module's pages in Chromium, for a journey scenario or an island scenario (ADR 0131). One browser per
// test process, a new context per scenario with the testkit's clock, one locale and time zone, reduced motion and a
// named viewport. A request that leaves loopback, an error in the browser's console and a failed request fail the
// scenario, like NOREAL does for the module.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { BrowserContext, Page as BrowserPage, Browser as Chromium } from "playwright-core";
import { FIXED_DATE } from "../support/process.ts";

/** The viewport sizes a UI test may use. */
export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const;
export type Viewport = keyof typeof VIEWPORTS;

export type { BrowserPage };

export interface Browser {
  /**
   * Opens the path of the server sut.http started in a new tab of the scenario's Chromium context, with the viewport
   * "desktop" unless named, and these headers on every request of the tab. Tabs of a scenario share its cookies.
   */
  open(path: string, options?: { viewport?: Viewport; headers?: Record<string, string> }): Promise<BrowserPage>;
  /** Runs axe-core on the page; a violation fails the test and names its rule and the elements. */
  expectAccessible(page: BrowserPage): Promise<void>;
  /**
   * Keeps a screenshot of the page as the journey's evidence: `reports/screenshots/<scenario ID>/<name>.png` in the
   * unit's folder, which proof turns into evidence on the pull request. The name is lowercase words with hyphens.
   */
  screenshot(page: BrowserPage, name: string): Promise<void>;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
let launched: Promise<Chromium> | undefined;
/**
 * The browser of this test process, started at its first use; Playwright loads only then, since most test processes
 * open no browser. Playwright stops it when the process ends.
 */
const shared = (): Promise<Chromium> => {
  launched ??= import("playwright-core").then(({ chromium }) => chromium.launch());
  return launched;
};

export function makeBrowser(
  base: () => string,
  moduleRoot: string,
  scenario: string,
  onStop: (stop: () => Promise<unknown>) => void,
): { browser: Browser; problems: () => string[] } {
  const problems: string[] = [];
  let context: Promise<BrowserContext> | undefined;

  const contextOf = (): Promise<BrowserContext> => {
    context ??= (async () => {
      const opened = await (await shared()).newContext({
        locale: "en-US",
        timezoneId: "UTC",
        reducedMotion: "reduce",
        viewport: VIEWPORTS.desktop,
      });
      onStop(() => opened.close());
      await opened.clock.setFixedTime(new Date(FIXED_DATE));
      await opened.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (LOOPBACK.has(url.hostname)) return route.continue();
        problems.push(`the browser refused a request that leaves loopback: ${url.href}`);
        return route.abort("blockedbyclient");
      });
      return opened;
    })();
    return context;
  };

  const browser: Browser = {
    async open(path, options = {}) {
      const page = await (await contextOf()).newPage();
      await page.setViewportSize(VIEWPORTS[options.viewport ?? "desktop"]);
      if (options.headers) await page.setExtraHTTPHeaders(options.headers);
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`an error in the browser's console: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`an error in the page's script: ${error.message}`));
      page.on("requestfailed", (request) => {
        const reason = request.failure()?.errorText ?? "";
        if (!reason.includes("ERR_BLOCKED_BY_CLIENT")) problems.push(`a request failed: ${request.url()} (${reason})`);
      });
      await page.goto(new URL(path, base()).href);
      return page;
    },
    async expectAccessible(page) {
      await page.evaluate(axeSource());
      const violations = (await page.evaluate(
        "axe.run(document).then((result) => result.violations.map((v) => v.id + ': ' + v.help + ' (' + v.nodes.map((n) => n.target.join(' ')).join(', ') + ')'))",
      )) as string[];
      if (violations.length > 0)
        throw new Error(`the page ${page.url()} has accessibility violations:\n${violations.join("\n")}`);
    },
    async screenshot(page, name) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
        throw new Error(`sut.browser.screenshot: "${name}" is not lowercase words with hyphens`);
      const folder = join(moduleRoot, "reports", "screenshots", scenario);
      mkdirSync(folder, { recursive: true });
      await page.screenshot({ path: join(folder, `${name}.png`), fullPage: true });
    },
  };
  return { browser, problems: () => problems.splice(0) };
}

let axe: string | undefined;
const axeSource = (): string => {
  axe ??= readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
  return axe;
};
