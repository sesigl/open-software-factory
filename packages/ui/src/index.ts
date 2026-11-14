// @opensoftware/ui: the files of the factory's design system (ADR 0133), for a server that serves them and a program
// that reads them. The tokens and the brand are files; the components are `.astro` files that a page compiles.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = (path: string): string => fileURLToPath(new URL(`../assets/${path}`, import.meta.url));

/** The absolute paths of the design system's files. */
export const files = {
  /** The tokens as CSS custom properties: dark by default, light with `data-theme="light"`. */
  tokens: file("tokens.css"),
  /** The icon: a sawtooth factory roof with an open door, in the current text colour. */
  icon: file("brand/icon.svg"),
  /** The icon beside "Open Software Factory". */
  wordmark: file("brand/wordmark.svg"),
  /** The icon in the signal colour on the dark ground, for a browser's tab. */
  favicon: file("brand/favicon.svg"),
};

/** The text of one of the files, for a server that serves it. */
export const text = (name: keyof typeof files): string => readFileSync(files[name], "utf8");
