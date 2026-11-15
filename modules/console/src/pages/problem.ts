// The data of a problem in the new look (src/web/pages/problem.astro): a request the console cannot answer, like a run
// that no foreman knows or a form that a module refused, with the reason and the way back. The template only reads it.
import type { ShellData } from "@opensoftware/ui";

export interface ProblemData {
  shell: ShellData;
  title: string;
  detail: string;
  /** The way back above the title, like the runs. */
  back: { href: string; text: string };
}

export const problemData = (shell: ShellData, title: string, detail: string, back: ProblemData["back"]) => ({
  shell,
  title,
  detail,
  back,
});
