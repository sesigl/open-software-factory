// The data of the page frame that a template of src/web/ shows (ADR 0132): computed here, so the template only reads it.
import type { NamedLink } from "../domain/runs.ts";
import type { Frame } from "./html.ts";

export interface FrameData {
  title: string;
  links: NamedLink[];
  inbox: boolean;
  work: boolean;
  improvement: boolean;
}

export const frameData = (frame: Frame): FrameData => ({
  title: frame.title,
  links: frame.links,
  inbox: Boolean(frame.inbox),
  work: Boolean(frame.work),
  improvement: Boolean(frame.improvement),
});
