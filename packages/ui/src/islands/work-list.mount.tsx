/** @jsxImportSource solid-js */
// The mount script of the island "work-list" (ADR 0152): `components/WorkList.astro` imports it in its `<script>`, which
// Astro bundles into an external module script. It renders the island in place of the list the server rendered, with
// the properties the server wrote on the element.
import { render } from "solid-js/web";
import type { WorkListProps } from "../index.ts";
import { WorkList } from "./work-list.tsx";

for (const element of document.querySelectorAll<HTMLElement>("[data-island='work-list']")) {
  const props = JSON.parse(String(element.dataset.props)) as WorkListProps;
  element.replaceChildren();
  render(() => <WorkList {...props} />, element);
}
