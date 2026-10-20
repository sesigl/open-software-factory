// Opens a page in headless Chromium with Playwright and keeps a screenshot, a video and a trace of it.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

export interface PageCapture {
  /** HTTP status of the page, or undefined when the browser got no response. */
  status: number | undefined;
  /** Whether the page showed the expected text; true when no text was expected. */
  shown: boolean;
}

/** How long the page may take to show the expected text. */
const EXPECT_TIMEOUT = 5_000;

/** Writes page.png, video.webm and trace.zip of the URL to the folder. */
export async function capturePage(url: string, folder: string, expect: string | undefined): Promise<PageCapture> {
  mkdirSync(folder, { recursive: true });
  const videos = mkdtempSync(join(folder, ".video-"));
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ recordVideo: { dir: videos } });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "load" });
    const shown =
      expect === undefined ||
      (await page
        .getByText(expect)
        .first()
        .waitFor({ state: "visible", timeout: EXPECT_TIMEOUT })
        .then(
          () => true,
          () => false,
        ));
    await page.screenshot({ path: join(folder, "page.png"), fullPage: true });
    await context.tracing.stop({ path: join(folder, "trace.zip") });
    const video = page.video();
    await context.close();
    await video?.saveAs(join(folder, "video.webm"));
    return { status: response?.status(), shown };
  } finally {
    await browser.close();
    rmSync(videos, { recursive: true, force: true });
  }
}
