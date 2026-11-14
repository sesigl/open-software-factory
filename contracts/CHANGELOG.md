# Changelog

## [2.4.0](https://github.com/sesigl/open-software-factory/compare/contracts-v2.3.0...contracts-v2.4.0) (2026-11-14)


### Features

* a run blocked at its checks tells its requester (T-45, ADR 0127); a sandbox probe in console doctor --deep (T-25, ADR 0120) ([#294](https://github.com/sesigl/open-software-factory/issues/294)) ([082cf02](https://github.com/sesigl/open-software-factory/commit/082cf023854adbdb39632cdfd65e5a0ede9b52c4))
* a stage that only waits, and ship waits for verify and proof (T-40 slice 1, ADR 0107) ([#277](https://github.com/sesigl/open-software-factory/issues/277)) ([d90a96c](https://github.com/sesigl/open-software-factory/commit/d90a96c3088e73247ee21cb4de71c0f471997e24))
* **console, foreman, gatekeeper:** act on runs and gates from the console, as the person (T-28, ADR 0118) ([#288](https://github.com/sesigl/open-software-factory/issues/288)) ([74929e5](https://github.com/sesigl/open-software-factory/commit/74929e51133f8c5c7219eaae2313a4311926fb3f))
* **contracts, foreman, console:** console doctor --deep sends a test event and finds it at the foreman (T-25, ADR 0120) ([#295](https://github.com/sesigl/open-software-factory/issues/295)) ([fa6214d](https://github.com/sesigl/open-software-factory/commit/fa6214d963203ba5ecbf727de8cfd572c75acaec))
* **factory-spec, contracts, foreman:** factory plan --adapters pins each adapter in factory.lock, and the foreman runs the pin (T-43, ADR 0125) ([#292](https://github.com/sesigl/open-software-factory/issues/292)) ([1236626](https://github.com/sesigl/open-software-factory/commit/1236626228191fc80600729324ff09e67a277f93))
* **foreman, console:** each stage's span carries its tokens and cost, and the console links it (T-24, ADR 0121) ([#290](https://github.com/sesigl/open-software-factory/issues/290)) ([a786f2d](https://github.com/sesigl/open-software-factory/commit/a786f2da73adbf24ff40c9e98d618b63cd4421bd))
* **foreman, factory-spec:** a clean factory and adapters at the factory's range (T-43, ADR 0110); a stage's result in the next prompt and lint warnings (T-44, ADR 0111) ([#280](https://github.com/sesigl/open-software-factory/issues/280)) ([e6abdc8](https://github.com/sesigl/open-software-factory/commit/e6abdc8fb4ad195043f078a85b50e3e62a5dab1a))
* **foreman, intake, console:** lists that stay fast (T-48, ADR 0115) ([#285](https://github.com/sesigl/open-software-factory/issues/285)) ([5e6f432](https://github.com/sesigl/open-software-factory/commit/5e6f432304710cdcab351089fc4a3e1ba312c8d6))
* **foreman, intake:** a second run's events, and the label put on again runs a failed work item again ([#274](https://github.com/sesigl/open-software-factory/issues/274)) ([f6c9151](https://github.com/sesigl/open-software-factory/commit/f6c91516d5916b2b01b0cc5b7360c8af2cc29c5f))
* **foreman:** run a run that failed or was cancelled again as a new run ([#273](https://github.com/sesigl/open-software-factory/issues/273)) ([973b7dd](https://github.com/sesigl/open-software-factory/commit/973b7dd9a619238752afa5f48c94532316882a48))
* **foreman:** the run's pull request comes from the forge, not from the agent's last link (T-42, ADR 0109) ([#279](https://github.com/sesigl/open-software-factory/issues/279)) ([ee34e5d](https://github.com/sesigl/open-software-factory/commit/ee34e5dacd05b8d5ee479e34349ee242e6e7eebf))
* **foreman:** waits for checks and gates end at a limit (T-39, ADR 0106) ([#276](https://github.com/sesigl/open-software-factory/issues/276)) ([b43994d](https://github.com/sesigl/open-software-factory/commit/b43994d03221e847d060b9c3737eeb00e898b0cd))

## [2.3.0](https://github.com/sesigl/open-software-factory/compare/contracts-v2.2.0...contracts-v2.3.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [2.2.0](https://github.com/sesigl/open-software-factory/compare/contracts-v2.1.0...contracts-v2.2.0) (2026-11-08)


### Features

* TODO.md wave 5, the v1 gaps (durable events, health, doctor, traces, evidence, console work and actions) ([#226](https://github.com/sesigl/open-software-factory/issues/226)) ([2787352](https://github.com/sesigl/open-software-factory/commit/27873526013a268d71ca9c738e2088a9f22c9b76))

## [2.1.0](https://github.com/sesigl/open-software-factory/compare/contracts-v2.0.0...contracts-v2.1.0) (2026-11-05)


### Features

* **tools:** RELEASE checks the publish workflow and release entries of every package ([#183](https://github.com/sesigl/open-software-factory/issues/183)) ([7f75236](https://github.com/sesigl/open-software-factory/commit/7f7523655c27dd8d0535ef1291be482c9ceb04ca))


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [2.0.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.10.0...contracts-v2.0.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* **contracts:** a factory definition without effort on each agent is invalid. Add effort to every agent before you use contracts 2.0.0.

### Features

* **contracts:** every agent declares its effort level ([#156](https://github.com/sesigl/open-software-factory/issues/156)) ([3c67f65](https://github.com/sesigl/open-software-factory/commit/3c67f651bd691f1b6b4db1088efd1c4b65bb7591))

## [1.10.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.9.0...contracts-v1.10.0) (2026-10-26)


### Features

* **foreman:** T-17 runs listed by state, work item status follows its run, and the evidence tool ([#128](https://github.com/sesigl/open-software-factory/issues/128)) ([3e6fea6](https://github.com/sesigl/open-software-factory/commit/3e6fea63d297e818f06c25a2370a9408172d872c))

## [1.9.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.8.0...contracts-v1.9.0) (2026-10-26)


### Features

* **foreman:** T-17 an inference gateway per factory, and a person takes over a run ([#126](https://github.com/sesigl/open-software-factory/issues/126)) ([f5a672e](https://github.com/sesigl/open-software-factory/commit/f5a672e6a25cd42b0c1afcbc08d7bde1b6114394))

## [1.8.0](https://github.com/sesigl/open-software-factory/compare/contracts-v1.7.0...contracts-v1.8.0) (2026-10-26)


### Features

* **foreman:** T-17 a failing CI check stops the stage that waits for it ([#124](https://github.com/sesigl/open-software-factory/issues/124)) ([dbb239b](https://github.com/sesigl/open-software-factory/commit/dbb239b86ccaa2f9b8dfafd1191666d8ea6003e6))

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
