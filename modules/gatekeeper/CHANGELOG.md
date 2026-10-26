# Changelog

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.3.0...gatekeeper-v0.4.0) (2026-10-26)


### Features

* **foreman:** T-17 runs of the factory's workflow on Temporal, with gates, steering and cancel ([#122](https://github.com/sesigl/open-software-factory/issues/122)) ([b62d1af](https://github.com/sesigl/open-software-factory/commit/b62d1af7eb33d52db64973a34b8050d69d8adb1d))
* **intake:** T-16 one inbox for agent work over HTTP, Slack and MCP ([#117](https://github.com/sesigl/open-software-factory/issues/117)) ([c4c27bf](https://github.com/sesigl/open-software-factory/commit/c4c27bf5b8c64c88f01005067c35cd030e9684b8))


### Bug Fixes

* **gatekeeper:** decide gates that 0.2 left pending; reject adapter output that is not JSON ([#116](https://github.com/sesigl/open-software-factory/issues/116)) ([c8f12ae](https://github.com/sesigl/open-software-factory/commit/c8f12aed791cfa8957b80731f9d55c00260e8827))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.2.0...gatekeeper-v0.3.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* **gatekeeper:** GATEKEEPER_FORGE_URL for Forgejo is the forge's origin, no longer <origin>/api/v1. Gates pending on an older server are asked again.

### Features

* **gatekeeper:** T-15 approvals and records through the channel and forge ports ([#109](https://github.com/sesigl/open-software-factory/issues/109)) ([65356d1](https://github.com/sesigl/open-software-factory/commit/65356d1ce59c7589c80c9f919ab86dc2cf38f032))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.1.0...gatekeeper-v0.2.0) (2026-10-23)


### Features

* **gatekeeper:** T-11 gatekeeper serve with an HTTP API, Slack events and buttons, and a Postgres outbox ([#84](https://github.com/sesigl/open-software-factory/issues/84)) ([d58cfca](https://github.com/sesigl/open-software-factory/commit/d58cfca8009733ff168580fb335a5cbaddf371c3))

## 0.1.0 (2026-10-22)


### Features

* **gatekeeper:** T-11 approvals by a Rego policy in Slack and pull requests, signed records (ADR 0047) ([#82](https://github.com/sesigl/open-software-factory/issues/82)) ([269f633](https://github.com/sesigl/open-software-factory/commit/269f633e78a09675cb14b1f876519962975de7b5))
