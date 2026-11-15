# Changelog

## [0.11.0](https://github.com/sesigl/open-software-factory/compare/console-v0.10.1...console-v0.11.0) (2026-11-15)


### Features

* **console:** remove the old stack and the route /pico.css (T-60) ([#355](https://github.com/sesigl/open-software-factory/issues/355)) ([a7909d1](https://github.com/sesigl/open-software-factory/commit/a7909d194fe0dbbf7f50e3763f3cd6af5863d1a3))
* **console:** the factory pages, the cost and scores and the health page in the new look (T-60) ([#354](https://github.com/sesigl/open-software-factory/issues/354)) ([7f8886d](https://github.com/sesigl/open-software-factory/commit/7f8886d8bb295744f121897b0721534d87367ed4))
* **console:** the run page and its forms in the new look (T-60) ([#352](https://github.com/sesigl/open-software-factory/issues/352)) ([80ca476](https://github.com/sesigl/open-software-factory/commit/80ca476c6fcb0e67a8ad8f528d9d20efbb92d38f))
* **console:** the work form and the inbox in the new look (T-60) ([#353](https://github.com/sesigl/open-software-factory/issues/353)) ([288f52f](https://github.com/sesigl/open-software-factory/commit/288f52ff8d1bffc7bcbb8bda6596168b00e3de49))
* **deploy:** the profile and the chart run a factory from a repository on a forge, with the check "factory" (T-58, ADR 0150) ([#346](https://github.com/sesigl/open-software-factory/issues/346)) ([e490044](https://github.com/sesigl/open-software-factory/commit/e4900442d1f677d5db126cf99c533f8903e62892))
* **ui, console:** buttons read well everywhere, and the runs are cards on a phone (T-54, T-60) ([#350](https://github.com/sesigl/open-software-factory/issues/350)) ([56d31d0](https://github.com/sesigl/open-software-factory/commit/56d31d0379c5b5a455c44535cf75d45087c2c41e))

## [0.10.1](https://github.com/sesigl/open-software-factory/compare/console-v0.10.0...console-v0.10.1) (2026-11-15)


### Bug Fixes

* **console, factory-spec:** release both again, as 0.10.0 and 0.12.0 got no release tag; the kind helper reads the proxy's image again ([#342](https://github.com/sesigl/open-software-factory/issues/342)) ([5f08723](https://github.com/sesigl/open-software-factory/commit/5f08723f4ca4c413e4a742bae170108dfc0a7bba))

## [0.10.0](https://github.com/sesigl/open-software-factory/compare/console-v0.9.0...console-v0.10.0) (2026-11-15)

This version was never published: its release got no tag. Version 0.10.1 holds these changes.


### Features

* **console:** a change to the factory from the UI is a pull request, with the page /changes (T-58, ADR 0144) ([#337](https://github.com/sesigl/open-software-factory/issues/337)) ([d20b961](https://github.com/sesigl/open-software-factory/commit/d20b9614c972d556f0c7d9eb3ef7c3badec7aed7))
* **console:** a factory engineer stores secrets, and an end-to-end scenario proves a stored value reaches a run (T-57, ADR 0148) ([#339](https://github.com/sesigl/open-software-factory/issues/339)) ([f126b90](https://github.com/sesigl/open-software-factory/commit/f126b904064016aca7024ea98027023d95d2f026))
* **console:** switch a skill on or off per agent, as one change with everything the skill needs (T-59, ADR 0149) ([#341](https://github.com/sesigl/open-software-factory/issues/341)) ([de950bd](https://github.com/sesigl/open-software-factory/commit/de950bd412f548dc121e1b9a282e2d166ca62f6d))
* **console:** the pages /skills and /skills/&lt;name&gt;, read-only, with safe Markdown (T-59, ADR 0141, ADR 0143) ([#332](https://github.com/sesigl/open-software-factory/issues/332)) ([5ce9bb8](https://github.com/sesigl/open-software-factory/commit/5ce9bb83202e2b60dd8fa271b3e5d670062dea87))


### Bug Fixes

* **cli:** a command named like toString or constructor names no command ([#335](https://github.com/sesigl/open-software-factory/issues/335)) ([c3bd872](https://github.com/sesigl/open-software-factory/commit/c3bd872b074ea799bc9264f70bbfa7028bed38f1))

## [0.9.0](https://github.com/sesigl/open-software-factory/compare/console-v0.8.1...console-v0.9.0) (2026-11-15)


### Features

* **console:** the page /secrets, where an admin stores a secret's value (T-57) ([#330](https://github.com/sesigl/open-software-factory/issues/330)) ([48af84a](https://github.com/sesigl/open-software-factory/commit/48af84ac43b1d7b097cf958732ef9cdbb8da7184))

## [0.8.1](https://github.com/sesigl/open-software-factory/compare/console-v0.8.0...console-v0.8.1) (2026-11-14)


### Bug Fixes

* **console:** the published console starts, and its probe answers a health check on every host ([#323](https://github.com/sesigl/open-software-factory/issues/323)) ([3a6d0fa](https://github.com/sesigl/open-software-factory/commit/3a6d0fafb03fd4bf37a6486287baeee63ca794a5))

## [0.8.0](https://github.com/sesigl/open-software-factory/compare/console-v0.7.0...console-v0.8.0) (2026-11-14)


### Features

* console doctor and factory lint check the sign-in, and the reference access.yaml (T-56) ([#319](https://github.com/sesigl/open-software-factory/issues/319)) ([6d77756](https://github.com/sesigl/open-software-factory/commit/6d77756b088c6f72e9c4d4e18387784043f00b67))
* **console:** the console's own sign-in with OpenID Connect or GitHub (T-56) ([#316](https://github.com/sesigl/open-software-factory/issues/316)) ([ee922e5](https://github.com/sesigl/open-software-factory/commit/ee922e53b7ae49d1b5b303392fa6b85660f5ce9f))
* **console:** the new look for sign-in and the runs, and roles behind a proxy (T-54, T-56) ([#317](https://github.com/sesigl/open-software-factory/issues/317)) ([95ed633](https://github.com/sesigl/open-software-factory/commit/95ed633d37ea86ac816975cf609a5b9873c703b4))
* **tools:** one job and a listed surface for every package, and osf ready for the sign-in (ADR 0135, T-56) ([#318](https://github.com/sesigl/open-software-factory/issues/318)) ([00743d6](https://github.com/sesigl/open-software-factory/commit/00743d651d2a3a910b8d155959c0742847a7bab0))

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
