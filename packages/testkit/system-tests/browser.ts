// The demo module of the sut.browser scenarios: a server of pages whose test opens "/" in Chromium.
import { pageModule } from "./module.ts";

/** Module demo whose page "/" is this HTML and whose test opens it with sut.browser and then runs `checks`. */
export const browserModule = (page: string, checks: string[] = [], pages: Record<string, string> = {}) =>
  pageModule(
    { "/": page, ...pages },
    [],
    ['When the user opens "/" in the browser', "Then the page works"],
    [
      "await sut.http.start();",
      "let page: Awaited<ReturnType<typeof sut.browser.open>>;",
      "await when('the user opens \"/\" in the browser', async () => {",
      '  page = await sut.browser.open("/", { viewport: "phone" });',
      "});",
      "await then('the page works', async () => {",
      ...checks.map((line) => `  ${line}`),
      "});",
    ],
  );

/** A page with this body and a title. */
export const html = (body: string) =>
  `<!doctype html><html lang="en"><head><title>Demo</title></head><body>${body}</body></html>`;
