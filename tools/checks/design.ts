// CONTRAST and TOKENS: the design system's rules for colour (ADR 0133). CONTRAST: every text token meets WCAG 2.2 AA
// contrast (4.5:1) on every background token, and `--osf-on-<name>` on `--osf-<name>`, in both themes. TOKENS: a page
// names the tokens; no colour value and no font name appears outside the tokens file, in the design system and the
// console.
import type { Context } from "./lib/context.ts";
import type { Finding } from "./lib/repo.ts";

const TOKENS_FILE = "packages/ui/assets/tokens.css";
const AA = 4.5;
/** The sources that must name tokens: the design system's and the console's. */
const SOURCES = ["packages/ui/src/**/*.{astro,css,ts,tsx}", "modules/console/src/**/*.{astro,css,ts,tsx}"];

type Theme = Map<string, string>;

/** The custom properties of the block that starts with the selector. */
function block(css: string, selector: string): Theme {
  const start = css.search(new RegExp(`(^|\\n)${selector.replace(/[[\]"()]/g, "\\$&")} \\{`));
  if (start < 0) return new Map();
  const body = css.slice(start, css.indexOf("}", start));
  return new Map(
    [...body.matchAll(/(--osf-[a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name ?? "", (value ?? "").trim()]),
  );
}

/** The relative luminance of a colour `#rrggbb`, or undefined for another value. */
function luminance(value: string): number | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (!hex) return undefined;
  const [r, g, b] = [0, 2, 4].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const ratio = (first: number, second: number): number =>
  (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

const isText = (name: string): boolean => /^--osf-(text(-|$)|signal$|state-)/.test(name);

export function contrast(context: Context): Finding[] {
  const { repo } = context;
  if (!repo.exists(TOKENS_FILE)) return [];
  const css = repo.read(TOKENS_FILE);
  const dark = block(css, ":root");
  const own = block(css, ':root[data-theme="light"]');
  const light = new Map([...dark, ...own]);
  const lightStart = css.indexOf(':root[data-theme="light"]');
  /** The line of a token's value in the theme: a light value that the light theme does not set is the dark one. */
  const lineOfToken = (name: string, themeName: string): number => {
    const from = themeName === "light" && own.has(name) ? lightStart : 0;
    return css.slice(0, css.indexOf(`${name}:`, from)).split("\n").length;
  };
  const findings: Finding[] = [];
  for (const [themeName, theme] of [
    ["dark", dark],
    ["light", light],
  ] as const) {
    const pairs: [string, string][] = [];
    const backgrounds = [...theme.keys()].filter((name) => name.startsWith("--osf-bg-"));
    for (const text of [...theme.keys()].filter(isText)) for (const ground of backgrounds) pairs.push([text, ground]);
    for (const name of theme.keys()) {
      const base = /^--osf-on-(.+)$/.exec(name)?.[1];
      if (base) pairs.push([name, `--osf-${base}`]);
    }
    for (const [text, ground] of pairs) {
      const [front, back] = [luminance(theme.get(text) ?? ""), luminance(theme.get(ground) ?? "")];
      if (front === undefined || back === undefined) {
        findings.push({
          check: "CONTRAST",
          file: TOKENS_FILE,
          line: lineOfToken(front === undefined ? text : ground, themeName),
          message: `${front === undefined ? text : ground} in the ${themeName} theme is no colour #rrggbb`,
        });
        continue;
      }
      const found = ratio(front, back);
      if (found >= AA) continue;
      findings.push({
        check: "CONTRAST",
        file: TOKENS_FILE,
        line: lineOfToken(text, themeName),
        message: `${text} on ${ground} in the ${themeName} theme has ${found.toFixed(2)}:1, WCAG 2.2 AA needs ${AA}:1`,
      });
    }
  }
  return findings;
}

/** A colour value: a hex colour, or a colour function. */
const COLOUR = /#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
/** A font declared in a style, and its value: a value must name a font token. */
const FONT = /\bfont(?:-family)?\s*:\s*([^;}]*)/i;

export function tokens(context: Context): Finding[] {
  const { repo } = context;
  const findings: Finding[] = [];
  for (const file of repo.match(...SOURCES)) {
    repo
      .read(file)
      .split("\n")
      .forEach((text, index) => {
        const colour = COLOUR.exec(text)?.[0];
        if (colour)
          findings.push({
            check: "TOKENS",
            file,
            line: index + 1,
            message: `the colour ${colour} is no token: name a token of ${TOKENS_FILE}`,
          });
        const font = FONT.exec(text)?.[1];
        if (font !== undefined && !font.includes("var(--osf-font-"))
          findings.push({
            check: "TOKENS",
            file,
            line: index + 1,
            message: `a font is named outside the tokens: use var(--osf-font-sans) or var(--osf-font-mono)`,
          });
      });
  }
  return findings;
}
