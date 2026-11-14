// The data of the shell of a page in the new look (@opensoftware/ui's Shell.astro, ADR 0133): the navigation with
// only the pages that work in this console, the account and the link to the other theme. The template only reads it.
import type { ShellData, ShellLink } from "@opensoftware/ui";
import { otherTheme, type Theme } from "../domain/theme.ts";
import type { Frame } from "./html.ts";

export interface ShellOf {
  title: string;
  /** The path and query of the page, for the way back from the theme link. */
  path: string;
  theme: Theme;
  factory: string | undefined;
  /** The count beside "Runs", like "1 waits", when the page knows it. */
  waiting?: string;
  refresh?: number;
  /** Whether the person signed in with the console's own sign-in, so that "Sign out" ends their session. */
  session: boolean;
}

export function shellData(frame: Omit<Frame, "title">, at: ShellOf): ShellData {
  const classic: ShellLink[] = [
    ...(frame.work ? [{ name: "Work", href: "/work" }] : []),
    { name: "Factory", href: "/factory" },
    ...(frame.inbox ? [{ name: "Inbox", href: "/inbox" }] : []),
    ...(frame.improvement ? [{ name: "Cost and scores", href: "/improvement" }] : []),
    { name: "Health", href: "/health" },
  ];
  const runs: ShellLink = { name: "Runs", href: "/", current: "page", ...(at.waiting ? { count: at.waiting } : {}) };
  return {
    title: at.title,
    theme: at.theme,
    ...(at.refresh ? { refresh: at.refresh } : {}),
    ...(at.factory ? { factory: at.factory } : {}),
    pages: [runs],
    classic,
    tools: frame.links.map((link) => ({ name: link.name, href: link.url })),
    ...(frame.person ? { person: { label: `${frame.person.email} · ${frame.person.role}` } } : {}),
    signOut: at.session,
    otherTheme: otherTheme(at.theme, at.path),
  };
}
