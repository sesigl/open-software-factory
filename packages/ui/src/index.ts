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

/** A link of the shell's navigation: the current page has `current`, and a page may show a count beside its name. */
export interface ShellLink {
  name: string;
  href: string;
  current?: "page";
  count?: string;
}

/**
 * What the shell of a page shows (`components/Shell.astro`): computed by the page's route, so that the template only
 * reads it (ADR 0132).
 */
export interface ShellData {
  /** The page's title, before " · Open Software Factory". */
  title: string;
  theme: "dark" | "light";
  /** Seconds after which the browser reloads the page. */
  refresh?: number;
  /**
   * Seconds after which a browser without script reloads the page: an island of the page keeps it fresh where script
   * runs, so a browser with script never reloads it (ADR 0152).
   */
  refreshWithoutScript?: number;
  /** The factory's name, when the page knows it. */
  factory?: string;
  /** The pages, with the current one. */
  pages: ShellLink[];
  /** The dashboards of other tools, like the traces. */
  tools: ShellLink[];
  /** The signed-in person: "<email> · <role>". */
  person?: { label: string };
  /** Whether the account offers "Sign out": only for a session of the console's own sign-in. */
  signOut: boolean;
  /** The link to the other theme. */
  otherTheme: ShellLink;
}

/** A cell's text, a link when it has `href`. */
export interface LinkText {
  href?: string;
  text: string;
}

/** A row of the work list, ready to show: the server computed every text (ADR 0152). */
export interface WorkListRow {
  title: LinkText;
  type: string;
  status: string;
  /** The classes of the status: its shape and colour. */
  statusClass: string;
  source: string;
  requester: string;
  run: LinkText;
  age: string;
}

/** The rows of the work list, and whether its source answered with none: also the answer of the list's route. */
export interface WorkListItems {
  rows: WorkListRow[];
  empty: boolean;
}

/** The properties of the island "work-list" (`islands/work-list.tsx`), which the server writes on its element. */
export interface WorkListProps extends WorkListItems {
  /** The route that answers the list's items as JSON (`WorkListItems`). */
  src: string;
  /** Milliseconds between two loads of the route; 0 loads it never. */
  interval: number;
  /** The names of the columns. */
  columns: string[];
  /** The text of an empty list. */
  emptyText: string;
  /** The text while the route does not answer the items; the list keeps the rows it had. */
  failedText: string;
}

/**
 * What `components/WorkList.astro` shows: the island's properties, and the same as JSON for its element, both computed
 * by the page's route, so that the template only reads them (ADR 0132).
 */
export interface WorkListData {
  /** The name of the list as a region of the page, like "Work items". */
  label: string;
  props: WorkListProps;
  /** `props` as JSON. */
  island: string;
}
