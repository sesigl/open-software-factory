// The data of the shell of a page in the new look (@opensoftware/ui's Shell.astro, ADR 0133): the navigation with
// only the pages that work in this console, the account and the link to the other theme. The template only reads it.
import type { ShellData, ShellLink } from "@opensoftware/ui";
import type { NamedLink } from "../domain/runs.ts";
import { otherTheme, type Theme } from "../domain/theme.ts";

/** What the navigation of every page shows: the dashboards, the optional pages that work, and the person. */
export interface Frame {
  links: NamedLink[];
  /** Whether the navigation links the inbox: only when it has a repository. */
  inbox?: boolean;
  /** Whether the navigation links the work items: only with intake's API. */
  work?: boolean;
  /** Whether the navigation links the cost and scores: only with CONSOLE_IMPROVE_DIR. */
  improvement?: boolean;
  /** Whether the navigation links Secrets: only for an admin or a factory engineer, in a console with a store. */
  secrets?: boolean;
  /** Whether the navigation links Changes: only with the factory's repository on a forge. */
  changes?: boolean;
  /** The signed-in person of the own sign-in, with their role and the form "Sign out" (ADR 0134). */
  person?: { email: string; role: string };
}

export interface ShellOf {
  title: string;
  /** The path and query of the page, for the way back from the theme link. */
  path: string;
  theme: Theme;
  factory: string | undefined;
  /** The link of the page that is open, like "/" or "/secrets". */
  current: string;
  /** The count beside the open page's link, like "1 waits" or "1 missing", when the page knows it. */
  count?: string;
  refresh?: number;
  /** Whether the person signed in with the console's own sign-in, so that "Sign out" ends their session. */
  session: boolean;
}

export function shellData(frame: Frame, at: ShellOf): ShellData {
  // Work with intake, the inbox with its repository (T-60). Secrets only for a person who may open it (ADR 0134,
  // ADR 0148): an admin or a factory engineer, in a console with a store. Skills in every mode, Changes with the
  // factory's repository on a forge (ADR 0144). Then the factory's definition, the cost and scores with the folder of
  // the improvement jobs, and the health (T-60).
  const pages: ShellLink[] = [
    { name: "Runs", href: "/" },
    ...(frame.work ? [{ name: "Work", href: "/work" }] : []),
    ...(frame.inbox ? [{ name: "Inbox", href: "/inbox" }] : []),
    ...(frame.secrets ? [{ name: "Secrets", href: "/secrets" }] : []),
    { name: "Skills", href: "/skills" },
    ...(frame.changes ? [{ name: "Changes", href: "/changes" }] : []),
    { name: "Factory", href: "/factory" },
    ...(frame.improvement ? [{ name: "Cost and scores", href: "/improvement" }] : []),
    { name: "Health", href: "/health" },
  ].map((link) =>
    link.href === at.current ? { ...link, current: "page", ...(at.count ? { count: at.count } : {}) } : link,
  );
  return {
    title: at.title,
    theme: at.theme,
    ...(at.refresh ? { refresh: at.refresh } : {}),
    ...(at.factory ? { factory: at.factory } : {}),
    pages,
    tools: frame.links.map((link) => ({ name: link.name, href: link.url })),
    ...(frame.person ? { person: { label: `${frame.person.email} · ${frame.person.role}` } } : {}),
    signOut: at.session,
    otherTheme: otherTheme(at.theme, at.path),
  };
}
