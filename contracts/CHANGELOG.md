# Changelog

## [1.7.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.6.0...contracts-v1.7.0) (2026-10-26)


### Features

* **foreman:** T-17 runs of the factory's workflow on Temporal, with gates, steering and cancel ([#122](https://github.com/sesigl/open-software-factory/issues/122)) ([b62d1af](https://github.com/sesigl/open-software-factory/commit/b62d1af7eb33d52db64973a34b8050d69d8adb1d))
* **intake:** T-16 issues labeled factory, one work item across surfaces, Sentry alerts ([#118](https://github.com/sesigl/open-software-factory/issues/118)) ([024c559](https://github.com/sesigl/open-software-factory/commit/024c55986a2c4f4a565e72f3272105d973d0a1ea))
* **intake:** T-16 one inbox for agent work over HTTP, Slack and MCP ([#117](https://github.com/sesigl/open-software-factory/issues/117)) ([c4c27bf](https://github.com/sesigl/open-software-factory/commit/c4c27bf5b8c64c88f01005067c35cd030e9684b8))

## [1.6.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.5.0...contracts-v1.6.0) (2026-10-23)


### Features

* **sandbox:** T-13 sandbox port and the docker adapter with an iron-proxy egress proxy ([#95](https://github.com/sesigl/open-software-factory/issues/95)) ([cf14d21](https://github.com/sesigl/open-software-factory/commit/cf14d21be6548ea35451650db2dc3f5f3df92141))

## [1.5.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.4.0...contracts-v1.5.0) (2026-10-23)


### Features

* **gatekeeper:** T-11 gatekeeper serve with an HTTP API, Slack events and buttons, and a Postgres outbox ([#84](https://github.com/sesigl/open-software-factory/issues/84)) ([d58cfca](https://github.com/sesigl/open-software-factory/commit/d58cfca8009733ff168580fb335a5cbaddf371c3))

## [1.4.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.3.0...contracts-v1.4.0) (2026-10-21)


### Features

* **cli:** shared libraries for the command line and run records (ADR 0039, 0040, 0041) ([#65](https://github.com/sesigl/open-software-factory/issues/65)) ([5f49dd9](https://github.com/sesigl/open-software-factory/commit/5f49dd9921d5dd086e53ab5c0359e2d4f8f3a1d2))

## [1.3.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.2.0...contracts-v1.3.0) (2026-10-21)


### Features

* **ledger:** T-08 cost per pull request and flow metrics from spend, runs and forge events ([#54](https://github.com/sesigl/open-software-factory/issues/54)) ([bff015b](https://github.com/sesigl/open-software-factory/commit/bff015be22d45ad59b09b28dc9affb12df4c0d9d))

## [1.2.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.1.0...contracts-v1.2.0) (2026-10-19)


### Features

* **factory-spec:** T-03 forge webhooks, render --k8s and --gh-aw, and a release ([#22](https://github.com/sesigl/open-software-factory/issues/22)) ([9da31e0](https://github.com/sesigl/open-software-factory/commit/9da31e04cbbe40dba07756aed123d9801b403431))


### Bug Fixes

* **release:** contracts version in openapi.json, and build contracts before publishing factory-spec ([#25](https://github.com/sesigl/open-software-factory/issues/25)) ([4322c4b](https://github.com/sesigl/open-software-factory/commit/4322c4be6e80a3b208ab3d2b3f1c9e60513b7db1))

## [1.1.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.0.0...contracts-v1.1.0) (2026-10-19)


### Features

* **checks:** REACH from coverage of the running module; T-02 done ([#19](https://github.com/sesigl/open-software-factory/issues/19)) ([82c4911](https://github.com/sesigl/open-software-factory/commit/82c49110ee44392d5577b2f6e28576c9cb2a36e3))
* **factory-spec:** T-03 lint, render, plan, apply, diff and resolve ([#20](https://github.com/sesigl/open-software-factory/issues/20)) ([657172c](https://github.com/sesigl/open-software-factory/commit/657172c60360156b9a7881c7224e621142f13414))
* **testkit:** T-02 sut.files refuses paths outside $INPUT and $OUTPUT ([#12](https://github.com/sesigl/open-software-factory/issues/12)) ([8221a09](https://github.com/sesigl/open-software-factory/commit/8221a097c6a46081faf9cbb26816f99eb253d9ab))


### Bug Fixes

* **ci:** publish contracts without provenance while the repository is private ([#7](https://github.com/sesigl/open-software-factory/issues/7)) ([4566123](https://github.com/sesigl/open-software-factory/commit/4566123edb8e3d5ef7c3f6f3701ec22b602221b9))

## 1.0.0 (2026-10-19)


### Features

* **contracts:** T-01 shared formats, npm publishing as [@opensoftware](https://github.com/opensoftware), no development gates ([#2](https://github.com/sesigl/open-software-factory/issues/2)) ([953bb2f](https://github.com/sesigl/open-software-factory/commit/953bb2ff68051943f91e85cb955b32744a0917b8))
