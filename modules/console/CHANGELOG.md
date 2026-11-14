# Changelog

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/console-v0.6.0...console-v0.7.0) (2026-11-14)


### Features

* sut.browser and UI checks (T-52 done), Astro renders the health page (T-53) ([#312](https://github.com/sesigl/open-software-factory/issues/312)) ([488ec0a](https://github.com/sesigl/open-software-factory/commit/488ec0ab2d325258191be2bbb216fb3de00352c2))
* **testkit:** sut.pages reads pages by role and name, and the console's tests use it (T-52) ([#310](https://github.com/sesigl/open-software-factory/issues/310)) ([8a6319a](https://github.com/sesigl/open-software-factory/commit/8a6319a1c48c5676547caf20d1db1d9853bf3a6d))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/console-v0.5.0...console-v0.6.0) (2026-11-14)


### Features

* a first run without guessing (T-47, ADR 0114) ([#284](https://github.com/sesigl/open-software-factory/issues/284)) ([7c5ccfa](https://github.com/sesigl/open-software-factory/commit/7c5ccfaad9bfdffe38bad6fa2cbc9e314ef44092))
* a run blocked at its checks tells its requester (T-45, ADR 0127); a sandbox probe in console doctor --deep (T-25, ADR 0120) ([#294](https://github.com/sesigl/open-software-factory/issues/294)) ([082cf02](https://github.com/sesigl/open-software-factory/commit/082cf023854adbdb39632cdfd65e5a0ede9b52c4))
* a stage that only waits, and ship waits for verify and proof (T-40 slice 1, ADR 0107) ([#277](https://github.com/sesigl/open-software-factory/issues/277)) ([d90a96c](https://github.com/sesigl/open-software-factory/commit/d90a96c3088e73247ee21cb4de71c0f471997e24))
* **console, foreman, gatekeeper:** act on runs and gates from the console, as the person (T-28, ADR 0118) ([#288](https://github.com/sesigl/open-software-factory/issues/288)) ([74929e5](https://github.com/sesigl/open-software-factory/commit/74929e51133f8c5c7219eaae2313a4311926fb3f))
* **console, foreman, testkit:** cost and scores page (T-31), trace-store deep check (T-25), factory from a Git remote (T-32) ([#291](https://github.com/sesigl/open-software-factory/issues/291)) ([466e0d2](https://github.com/sesigl/open-software-factory/commit/466e0d29f69e18104a76d9bfbda1f6867edb50f0))
* **console:** console doctor --deep calls each model route and asks the harness to initialize (T-25, ADR 0120) ([#289](https://github.com/sesigl/open-software-factory/issues/289)) ([5ec4c80](https://github.com/sesigl/open-software-factory/commit/5ec4c801a86e38bb8d4cd4fddc249727a131751b))
* **console:** run a failed or cancelled run again from its page ([#275](https://github.com/sesigl/open-software-factory/issues/275)) ([9e44b80](https://github.com/sesigl/open-software-factory/commit/9e44b80140d28039f14696563c9ab08f9eb6b566))
* **contracts, foreman, console:** console doctor --deep sends a test event and finds it at the foreman (T-25, ADR 0120) ([#295](https://github.com/sesigl/open-software-factory/issues/295)) ([fa6214d](https://github.com/sesigl/open-software-factory/commit/fa6214d963203ba5ecbf727de8cfd572c75acaec))
* **foreman, console:** each stage's span carries its tokens and cost, and the console links it (T-24, ADR 0121) ([#290](https://github.com/sesigl/open-software-factory/issues/290)) ([a786f2d](https://github.com/sesigl/open-software-factory/commit/a786f2da73adbf24ff40c9e98d618b63cd4421bd))
* **foreman, intake, console:** lists that stay fast (T-48, ADR 0115) ([#285](https://github.com/sesigl/open-software-factory/issues/285)) ([5e6f432](https://github.com/sesigl/open-software-factory/commit/5e6f432304710cdcab351089fc4a3e1ba312c8d6))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/console-v0.4.0...console-v0.5.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/console-v0.3.1...console-v0.4.0) (2026-11-08)


### Features

* TODO.md wave 5, the v1 gaps (durable events, health, doctor, traces, evidence, console work and actions) ([#226](https://github.com/sesigl/open-software-factory/issues/226)) ([2787352](https://github.com/sesigl/open-software-factory/commit/27873526013a268d71ca9c738e2088a9f22c9b76))

## [0.3.1](https://github.com/sesigl/open-software-factory/compare/console-v0.3.0...console-v0.3.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/console-v0.2.0...console-v0.3.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* **contracts:** a factory definition without effort on each agent is invalid. Add effort to every agent before you use contracts 2.0.0.

### Features

* **contracts:** every agent declares its effort level ([#156](https://github.com/sesigl/open-software-factory/issues/156)) ([3c67f65](https://github.com/sesigl/open-software-factory/commit/3c67f651bd691f1b6b4db1088efd1c4b65bb7591))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/console-v0.1.0...console-v0.2.0) (2026-10-27)


### Features

* **console:** T-18 the self-improvement inbox and the forge port's prs ([#132](https://github.com/sesigl/open-software-factory/issues/132)) ([8b5cab2](https://github.com/sesigl/open-software-factory/commit/8b5cab270c70391422af414a9907b776904e8076))

## 0.1.0 (2026-10-27)


### Features

* **console:** T-18 the read-only web view of runs, their origin and evidence, and the factory's configuration ([#130](https://github.com/sesigl/open-software-factory/issues/130)) ([4916814](https://github.com/sesigl/open-software-factory/commit/491681452a6cb17db4812a0433337bb0c843c55c))
