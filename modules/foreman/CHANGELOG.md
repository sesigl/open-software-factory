# Changelog

## [0.12.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.11.0...foreman-v0.12.0) (2026-11-14)


### Features

* **testkit:** fakes.postgres and fakes.temporal start one server per test process (ADR 0129) ([#302](https://github.com/sesigl/open-software-factory/issues/302)) ([a8174b9](https://github.com/sesigl/open-software-factory/commit/a8174b9e6e3ff0b03b39b252cbb4bc9691d3a235))

## [0.11.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.10.0...foreman-v0.11.0) (2026-11-14)


### Features

* **foreman:** a sandboxed stage's run record reaches transcripts/ and its span (T-31, ADR 0121) ([#298](https://github.com/sesigl/open-software-factory/issues/298)) ([8b1a8c5](https://github.com/sesigl/open-software-factory/commit/8b1a8c5d8a43964ca9ade49628c4ad45ba434927))

## [0.10.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.9.0...foreman-v0.10.0) (2026-11-14)


### Features

* a run blocked at its checks tells its requester (T-45, ADR 0127); a sandbox probe in console doctor --deep (T-25, ADR 0120) ([#294](https://github.com/sesigl/open-software-factory/issues/294)) ([082cf02](https://github.com/sesigl/open-software-factory/commit/082cf023854adbdb39632cdfd65e5a0ede9b52c4))
* a stage that only waits, and ship waits for verify and proof (T-40 slice 1, ADR 0107) ([#277](https://github.com/sesigl/open-software-factory/issues/277)) ([d90a96c](https://github.com/sesigl/open-software-factory/commit/d90a96c3088e73247ee21cb4de71c0f471997e24))
* **console, foreman, gatekeeper:** act on runs and gates from the console, as the person (T-28, ADR 0118) ([#288](https://github.com/sesigl/open-software-factory/issues/288)) ([74929e5](https://github.com/sesigl/open-software-factory/commit/74929e51133f8c5c7219eaae2313a4311926fb3f))
* **console, foreman, testkit:** cost and scores page (T-31), trace-store deep check (T-25), factory from a Git remote (T-32) ([#291](https://github.com/sesigl/open-software-factory/issues/291)) ([466e0d2](https://github.com/sesigl/open-software-factory/commit/466e0d29f69e18104a76d9bfbda1f6867edb50f0))
* **contracts, foreman, console:** console doctor --deep sends a test event and finds it at the foreman (T-25, ADR 0120) ([#295](https://github.com/sesigl/open-software-factory/issues/295)) ([fa6214d](https://github.com/sesigl/open-software-factory/commit/fa6214d963203ba5ecbf727de8cfd572c75acaec))
* events not lost without a trace (T-49, ADR 0116); vision status lines checked (T-50, ADR 0117) ([#286](https://github.com/sesigl/open-software-factory/issues/286)) ([a737849](https://github.com/sesigl/open-software-factory/commit/a737849cb05f9f07fed193f0884edb28ed7a7a12))
* **factory-spec, contracts, foreman:** factory plan --adapters pins each adapter in factory.lock, and the foreman runs the pin (T-43, ADR 0125) ([#292](https://github.com/sesigl/open-software-factory/issues/292)) ([1236626](https://github.com/sesigl/open-software-factory/commit/1236626228191fc80600729324ff09e67a277f93))
* **foreman, console:** each stage's span carries its tokens and cost, and the console links it (T-24, ADR 0121) ([#290](https://github.com/sesigl/open-software-factory/issues/290)) ([a786f2d](https://github.com/sesigl/open-software-factory/commit/a786f2da73adbf24ff40c9e98d618b63cd4421bd))
* **foreman, factory-spec:** a clean factory and adapters at the factory's range (T-43, ADR 0110); a stage's result in the next prompt and lint warnings (T-44, ADR 0111) ([#280](https://github.com/sesigl/open-software-factory/issues/280)) ([e6abdc8](https://github.com/sesigl/open-software-factory/commit/e6abdc8fb4ad195043f078a85b50e3e62a5dab1a))
* **foreman, intake, console:** lists that stay fast (T-48, ADR 0115) ([#285](https://github.com/sesigl/open-software-factory/issues/285)) ([5e6f432](https://github.com/sesigl/open-software-factory/commit/5e6f432304710cdcab351089fc4a3e1ba312c8d6))
* **foreman, intake:** a second run's events, and the label put on again runs a failed work item again ([#274](https://github.com/sesigl/open-software-factory/issues/274)) ([f6c9151](https://github.com/sesigl/open-software-factory/commit/f6c91516d5916b2b01b0cc5b7360c8af2cc29c5f))
* **foreman:** a stage's agent gets its MCP servers and skills, also in a sandbox (T-44, ADR 0112) ([#281](https://github.com/sesigl/open-software-factory/issues/281)) ([a459ff6](https://github.com/sesigl/open-software-factory/commit/a459ff627ac329baea852dc9fe7a89f0dda2dcbe))
* **foreman:** an agent's repositories are cloned into its folder before its turn (T-44, ADR 0126) ([#293](https://github.com/sesigl/open-software-factory/issues/293)) ([55b9e18](https://github.com/sesigl/open-software-factory/commit/55b9e18a01d3cd100b49aeeb96c4c46acd3859bf))
* **foreman:** run a run that failed or was cancelled again as a new run ([#273](https://github.com/sesigl/open-software-factory/issues/273)) ([973b7dd](https://github.com/sesigl/open-software-factory/commit/973b7dd9a619238752afa5f48c94532316882a48))
* **foreman:** the run's pull request comes from the forge, not from the agent's last link (T-42, ADR 0109) ([#279](https://github.com/sesigl/open-software-factory/issues/279)) ([ee34e5d](https://github.com/sesigl/open-software-factory/commit/ee34e5dacd05b8d5ee479e34349ee242e6e7eebf))
* **foreman:** waits for checks and gates end at a limit (T-39, ADR 0106) ([#276](https://github.com/sesigl/open-software-factory/issues/276)) ([b43994d](https://github.com/sesigl/open-software-factory/commit/b43994d03221e847d060b9c3737eeb00e898b0cd))
* **inference:** one key and one budget per run, revoked when the run ended (T-41, ADR 0108) ([#278](https://github.com/sesigl/open-software-factory/issues/278)) ([ff13c49](https://github.com/sesigl/open-software-factory/commit/ff13c49f78cb8d168bdf656bd006e13ece47b951))
* **tools:** osf init, up and doctor, and the first-run tutorial (T-30, ADR 0119) ([#287](https://github.com/sesigl/open-software-factory/issues/287)) ([f6a67f1](https://github.com/sesigl/open-software-factory/commit/f6a67f1d476b5c4021aa6c22c90badf68ea8a318))

## [0.9.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.8.0...foreman-v0.9.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))


### Bug Fixes

* **foreman:** stop at once on SIGTERM, and a stage that ran then runs again soon ([#256](https://github.com/sesigl/open-software-factory/issues/256)) ([87201de](https://github.com/sesigl/open-software-factory/commit/87201de9974c9d8c367f1b49936843cb7382d753))

## [0.8.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.7.0...foreman-v0.8.0) (2026-11-10)


### Features

* **foreman:** FOREMAN_SANDBOX picks the sandbox adapter of a factory that names none ([#243](https://github.com/sesigl/open-software-factory/issues/243)) ([d46c5a6](https://github.com/sesigl/open-software-factory/commit/d46c5a60998b5e0d727542421b4015290ee27698))


### Performance Improvements

* **foreman:** start the inference gateway in the background, so foreman does not wait for LiteLLM ([#251](https://github.com/sesigl/open-software-factory/issues/251)) ([0b683e9](https://github.com/sesigl/open-software-factory/commit/0b683e941ddd7adfd7f0bfa9bf150ec60f8cc071))

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.6.1...foreman-v0.7.0) (2026-11-08)


### Features

* TODO.md wave 5, the v1 gaps (durable events, health, doctor, traces, evidence, console work and actions) ([#226](https://github.com/sesigl/open-software-factory/issues/226)) ([2787352](https://github.com/sesigl/open-software-factory/commit/27873526013a268d71ca9c738e2088a9f22c9b76))


### Bug Fixes

* no leaked containers from local runs ([#227](https://github.com/sesigl/open-software-factory/issues/227)) ([4d8afbc](https://github.com/sesigl/open-software-factory/commit/4d8afbc71d49366071f021731db3fec69b08567f))


### Performance Improvements

* **ci:** shard the nightly mutation run and replay unchanged shards ([#187](https://github.com/sesigl/open-software-factory/issues/187)) ([e38b1b8](https://github.com/sesigl/open-software-factory/commit/e38b1b8607cca7dd46f2251df74465a26d84aaaf))

## [0.6.1](https://github.com/sesigl/open-software-factory/compare/foreman-v0.6.0...foreman-v0.6.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.5.0...foreman-v0.6.0) (2026-11-04)


### Features

* **foreman:** a stage's prompt names the work item's origin, and a gate request links the run's pull request ([#171](https://github.com/sesigl/open-software-factory/issues/171)) ([82aa0bd](https://github.com/sesigl/open-software-factory/commit/82aa0bde47d28924b27f979fe39051f314d59d76))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.4.1...foreman-v0.5.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* **contracts:** a factory definition without effort on each agent is invalid. Add effort to every agent before you use contracts 2.0.0.

### Features

* **contracts:** every agent declares its effort level ([#156](https://github.com/sesigl/open-software-factory/issues/156)) ([3c67f65](https://github.com/sesigl/open-software-factory/commit/3c67f651bd691f1b6b4db1088efd1c4b65bb7591))

## [0.4.1](https://github.com/sesigl/open-software-factory/compare/foreman-v0.4.0...foreman-v0.4.1) (2026-11-01)


### Bug Fixes

* **foreman:** stop without waiting for the harness timer ([#152](https://github.com/sesigl/open-software-factory/issues/152)) ([fca6b88](https://github.com/sesigl/open-software-factory/commit/fca6b8852cb46a6e84e240e7a8d1faf58af6655a))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.3.0...foreman-v0.4.0) (2026-10-26)


### Features

* **foreman:** T-17 runs listed by state, work item status follows its run, and the evidence tool ([#128](https://github.com/sesigl/open-software-factory/issues/128)) ([3e6fea6](https://github.com/sesigl/open-software-factory/commit/3e6fea63d297e818f06c25a2370a9408172d872c))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.2.0...foreman-v0.3.0) (2026-10-26)


### Features

* **foreman:** T-17 an inference gateway per factory, and a person takes over a run ([#126](https://github.com/sesigl/open-software-factory/issues/126)) ([f5a672e](https://github.com/sesigl/open-software-factory/commit/f5a672e6a25cd42b0c1afcbc08d7bde1b6114394))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.1.0...foreman-v0.2.0) (2026-10-26)


### Features

* **foreman:** T-17 a failing CI check stops the stage that waits for it ([#124](https://github.com/sesigl/open-software-factory/issues/124)) ([dbb239b](https://github.com/sesigl/open-software-factory/commit/dbb239b86ccaa2f9b8dfafd1191666d8ea6003e6))

## 0.1.0 (2026-10-26)


### Features

* **foreman:** T-17 each stage runs in a sandbox through the sandbox port ([#123](https://github.com/sesigl/open-software-factory/issues/123)) ([70aae93](https://github.com/sesigl/open-software-factory/commit/70aae93f2d5cf76d226bce184855bf30376efc13))
* **foreman:** T-17 runs of the factory's workflow on Temporal, with gates, steering and cancel ([#122](https://github.com/sesigl/open-software-factory/issues/122)) ([b62d1af](https://github.com/sesigl/open-software-factory/commit/b62d1af7eb33d52db64973a34b8050d69d8adb1d))
