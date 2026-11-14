// The theme of the factory's UI (ADR 0133): dark unless the cookie "osf_theme" says light. The server writes it on
// the page, so nothing flashes and no script runs; the system's preference is not followed.
export type Theme = "dark" | "light";

/** The theme of a request's cookies. */
export const themeOf = (cookie: string | undefined): Theme =>
  /(?:^|;\s*)osf_theme=light(?:;|$)/.test(cookie ?? "") ? "light" : "dark";

/** The cookie that keeps a theme for a year; it holds no person and no secret. */
export const themeCookie = (theme: Theme): string => `osf_theme=${theme}; Path=/; SameSite=Lax; Max-Age=31536000`;

/** The link to the theme that is not this one, back to the page `path`. */
export const otherTheme = (theme: Theme, path: string): { name: string; href: string } => {
  const other: Theme = theme === "dark" ? "light" : "dark";
  return {
    name: other === "light" ? "Light theme" : "Dark theme",
    href: `/theme?to=${other}&next=${encodeURIComponent(path)}`,
  };
};
