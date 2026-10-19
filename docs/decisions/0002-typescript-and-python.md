---
status: superseded by 0009
date: 2026-10-18
---

# 0002. TypeScript and Python as the only core languages

## Context
The tools integrate with MCP, ACP, Vercel Chat SDK, Harbor, LiteLLM and Langfuse, and should attract outside
contributors. The maintainer's strongest language is Java.

## Decision
TypeScript for tools and adapters; Python for runlog, scorekit, taskcapture, observer and the ledger CLI. No
third core language. Java teams integrate through clients generated from `contracts/`.

## Options considered
See the weighted scoring in `docs/architecture/stack.md`: TypeScript 90, Python 77, Go 67, Java 60.

## Prior art
Microsoft's Java bot SDK is retired and its successors support C#, JavaScript and Python only; Vercel Chat SDK is
TypeScript only; Harbor and LiteLLM are Python; MCP has an official Java SDK; Temporal supports all four.

## Consequences
Two toolchains to maintain. Revisit for the foreman if Java speed matters more than contributor reach.
