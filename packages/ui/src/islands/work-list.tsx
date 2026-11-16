/** @jsxImportSource solid-js */
// The island "work-list" (ADR 0152): the table of work items that the server rendered, kept fresh in the browser. It
// loads its route every `interval` milliseconds and shows the rows it answers, which the server made ready to show;
// while the route fails it keeps the rows it had and says so. It decides nothing else: every text is a property.
import { createSignal, For, Show } from "solid-js";
import type { LinkText, WorkListItems, WorkListProps } from "../index.ts";

const Cell = (props: { value: LinkText }) => (
  <Show when={props.value.href} fallback={props.value.text}>
    <a href={props.value.href}>{props.value.text}</a>
  </Show>
);

export function WorkList(props: WorkListProps) {
  // The rows shown, and whether the last load failed: a failure keeps the rows, the next answer replaces both.
  const [list, setList] = createSignal({ rows: props.rows, empty: props.empty, failed: false });
  const load = async () => {
    let answer: WorkListItems | undefined;
    try {
      answer = (await (await fetch(props.src)).json()) as WorkListItems;
    } catch {
      // No answer, or one that is no JSON, like the sign-in page.
    }
    // An answer without rows, like a problem, the sign-in page or none at all, is a failure, whatever its status.
    setList(
      Array.isArray(answer?.rows)
        ? { rows: answer.rows, empty: answer.empty, failed: false }
        : { ...list(), failed: true },
    );
  };
  // The island lives as long as its page, so its timer does too.
  if (props.interval > 0) setInterval(load, props.interval);
  return (
    <>
      <Show when={list().failed}>
        <p role="alert" class="osf-alert">
          {props.failedText}
        </p>
      </Show>
      <Show when={list().empty}>
        <p class="osf-empty">{props.emptyText}</p>
      </Show>
      <div class="osf-table-panel">
        <table class="osf-table osf-cards">
          <thead>
            <tr>
              <For each={props.columns}>{(column) => <th scope="col">{column}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={list().rows}>
              {(row) => (
                <tr>
                  <td class="osf-card-title">
                    <Cell value={row.title} />
                  </td>
                  <td>{row.type}</td>
                  <td class="osf-card-state">
                    <span class={row.statusClass}>{row.status}</span>
                  </td>
                  <td>{row.source}</td>
                  <td>{row.requester}</td>
                  <td class="osf-mono">
                    <Cell value={row.run} />
                  </td>
                  <td class="osf-mono osf-card-corner">{row.age}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </>
  );
}
