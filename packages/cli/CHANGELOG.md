# Changelog

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/cli-v0.4.1...cli-v0.5.0) (2026-11-17)


### ⚠ BREAKING CHANGES

* **cli, testkit, gatekeeper, foreman, console, intake, proof, runlog, scorekit, channel-slack:** a gatekeeper, foreman, console, intake, proof, runlog, scorekit or channel-slack process started with OSF_NOW (or console with OSF_SEED) set and without OSF_TEST_HOOKS=1 now exits 2 instead of running on that clock or seed; unset the variable. gatekeeper serve with a GATEKEEPER_POLL_MS that is no whole number of 1 or more (like 0, -5 or 1s) now exits 2 instead of falling back to 30 s or polling at once.

### Features

* **cli, testkit, gatekeeper, foreman, console, intake, proof, runlog, scorekit, channel-slack:** test hooks need an explicit switch (T-93) ([#400](https://github.com/sesigl/open-software-factory/issues/400)) ([135c9cd](https://github.com/sesigl/open-software-factory/commit/135c9cd66e1423e8159ca5eb06b3a20d43555863))
* **tools, testkit:** BUDGET measures the wall time of a suite (T-74, ADR 0155) ([#379](https://github.com/sesigl/open-software-factory/issues/379)) ([fde5791](https://github.com/sesigl/open-software-factory/commit/fde57913171d572f9aa9b03c93b7048da75b10c0))

## [0.4.1](https://github.com/sesigl/open-software-factory/compare/cli-v0.4.0...cli-v0.4.1) (2026-11-15)


### Bug Fixes

* **cli:** a command named like toString or constructor names no command ([#335](https://github.com/sesigl/open-software-factory/issues/335)) ([c3bd872](https://github.com/sesigl/open-software-factory/commit/c3bd872b074ea799bc9264f70bbfa7028bed38f1))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/cli-v0.3.0...cli-v0.4.0) (2026-11-14)


### Features

* **tools:** one job and a listed surface for every package, and osf ready for the sign-in (ADR 0135, T-56) ([#318](https://github.com/sesigl/open-software-factory/issues/318)) ([00743d6](https://github.com/sesigl/open-software-factory/commit/00743d651d2a3a910b8d155959c0742847a7bab0))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/cli-v0.2.0...cli-v0.3.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/cli-v0.1.1...cli-v0.2.0) (2026-11-08)


### Features

* TODO.md wave 5, the v1 gaps (durable events, health, doctor, traces, evidence, console work and actions) ([#226](https://github.com/sesigl/open-software-factory/issues/226)) ([2787352](https://github.com/sesigl/open-software-factory/commit/27873526013a268d71ca9c738e2088a9f22c9b76))

## [0.1.1](https://github.com/sesigl/open-software-factory/compare/cli-v0.1.0...cli-v0.1.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## 0.1.0 (2026-10-21)


### Features

* **cli:** shared libraries for the command line and run records (ADR 0039, 0040, 0041) ([#65](https://github.com/sesigl/open-software-factory/issues/65)) ([5f49dd9](https://github.com/sesigl/open-software-factory/commit/5f49dd9921d5dd086e53ab5c0359e2d4f8f3a1d2))
