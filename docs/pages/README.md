---
covers: [docs/pages/**]
---

# Overview pages

Self-contained HTML pages that present the planning work visually, with diagrams. Open them in a browser
(download the file or use a local static server). They are snapshots from 2026-10-18 and are not kept current;
the Markdown documents are the source of truth and win where a page differs. Agents should read the Markdown
documents, not these pages.

| Page | Shows | Source of truth |
| --- | --- | --- |
| [1-blueprint.html](1-blueprint.html) | The talk chapter by chapter, 17 principles, the stack, all requirement scenarios, metric catalogue, open questions | [`../vision/`](../vision/), [`../principles.md`](../principles.md) |
| [2-component-map.html](2-component-map.html) | The tools, the wiring diagram, five shared formats, adopt-vs-build, release waves | [`../architecture/components.md`](../architecture/components.md) |
| [3-internals.html](3-internals.html) | Ports and adapters, factory as code, the three loops, OpenTelemetry support, protocols and registries | [`../architecture/internals.md`](../architecture/internals.md) |
| [4-stack.html](4-stack.html) | Technology choices with pros and cons | [`../architecture/stack.md`](../architecture/stack.md), [`../decisions/`](../decisions/) |
| [5-quality-gates.html](5-quality-gates.html) | Test boundary diagram, checks, testing strategy, smoke tests, agent rules, module tiers | [`../quality/`](../quality/), [`../explanation/`](../explanation/) |

Known differences: page 4 and the decisions section of page 2 still describe TypeScript plus Python and
"Nx later"; see ADR 0009 and ADR 0010 for the current decisions.
