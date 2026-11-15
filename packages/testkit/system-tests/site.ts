// The demo library of the sut.site scenarios: a folder "site" that its test serves, and a script instrumented by hand
// in the shape Stryker 10 emits (ADR 0152), so the scenarios need no Stryker run.
import { demoModule } from "./module.ts";

/** The policy of a page whose scripts come only from its own origin, as the console's island pages will have it. */
export const POLICY = "script-src 'self'";

/** Library demo with these files below its folder, whose test runs `test` under the Gherkin `steps`. */
export const siteModule = (files: Record<string, string>, steps: string[], test: string[]) => {
  const module = demoModule({ library: true, steps, test });
  for (const [path, content] of Object.entries(files)) module[`$INPUT/${path}`] = content;
  return module;
};

/** A page with this title and body. */
export const page = (title: string, body: string, head = "") =>
  `<!doctype html><html lang="en"><head><title>${title}</title>${head}</head><body>${body}</body></html>`;

// The header the installed Stryker (10.0.0) writes at the top of every instrumented file, as printed by its
// instrumenter: it reads the active mutant from globalThis.__stryker__, or from process.env where `process` exists.
const STRYKER_HEADER = `function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
`;

/**
 * The folder "site" of the clock: a page whose external script shows "morning" for the hour 9, instrumented with the
 * mutant "7" that turns `hour < 12` into `hour >= 12`, which shows "afternoon".
 */
export const CLOCK = {
  "site/index.html": page(
    "Clock",
    "<main><h1>Clock</h1><output></output></main>",
    '<script type="module" src="/clock.js"></script>',
  ),
  "site/clock.js": `${STRYKER_HEADER}const hour = 9;
document.querySelector("output").textContent = (stryMutAct_9fa48("7") ? hour >= 12 : (stryCov_9fa48("7"), hour < 12)) ? "morning" : "afternoon";
`,
};

/** The test of the clock: it serves "site" with the policy, opens "/" in the browser and expects the status `shown`. */
export const clockTest = (shown: string) => ({
  steps: [
    'Given the folder "site" is served',
    'When the user opens "/" in the browser',
    `Then the status is "${shown}"`,
  ],
  test: [
    "await given('the folder \"site\" is served', async () => {",
    `  await sut.site.serve("site", { headers: { "Content-Security-Policy": "${POLICY}" } });`,
    "});",
    "let page: Awaited<ReturnType<typeof sut.browser.open>>;",
    "await when('the user opens \"/\" in the browser', async () => {",
    '  page = await sut.browser.open("/");',
    "});",
    `await then('the status is "${shown}"', async () => {`,
    `  expect(await page.getByRole("status").textContent()).toBe("${shown}");`,
    "});",
  ],
});
