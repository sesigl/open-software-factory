# Changelog

## [0.8.0](https://github.com/sesigl/open-software-factory/compare/factory-spec-v0.7.0...factory-spec-v0.8.0) (2026-11-14)


### Features

* a stage that only waits, and ship waits for verify and proof (T-40 slice 1, ADR 0107) ([#277](https://github.com/sesigl/open-software-factory/issues/277)) ([d90a96c](https://github.com/sesigl/open-software-factory/commit/d90a96c3088e73247ee21cb4de71c0f471997e24))
* **factory-spec, contracts, foreman:** factory plan --adapters pins each adapter in factory.lock, and the foreman runs the pin (T-43, ADR 0125) ([#292](https://github.com/sesigl/open-software-factory/issues/292)) ([1236626](https://github.com/sesigl/open-software-factory/commit/1236626228191fc80600729324ff09e67a277f93))
* **foreman, factory-spec:** a clean factory and adapters at the factory's range (T-43, ADR 0110); a stage's result in the next prompt and lint warnings (T-44, ADR 0111) ([#280](https://github.com/sesigl/open-software-factory/issues/280)) ([e6abdc8](https://github.com/sesigl/open-software-factory/commit/e6abdc8fb4ad195043f078a85b50e3e62a5dab1a))
* **foreman:** an agent's repositories are cloned into its folder before its turn (T-44, ADR 0126) ([#293](https://github.com/sesigl/open-software-factory/issues/293)) ([55b9e18](https://github.com/sesigl/open-software-factory/commit/55b9e18a01d3cd100b49aeeb96c4c46acd3859bf))

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/factory-spec-v0.6.1...factory-spec-v0.7.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.6.1](https://github.com/sesigl/open-software-factory/compare/factory-spec-v0.6.0...factory-spec-v0.6.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/factory-spec-v0.5.0...factory-spec-v0.6.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* **contracts:** a factory definition without effort on each agent is invalid. Add effort to every agent before you use contracts 2.0.0.

### Features

* **contracts:** every agent declares its effort level ([#156](https://github.com/sesigl/open-software-factory/issues/156)) ([3c67f65](https://github.com/sesigl/open-software-factory/commit/3c67f651bd691f1b6b4db1088efd1c4b65bb7591))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/factory-spec-v0.4.0...factory-spec-v0.5.0) (2026-10-27)


### Features

* **deploy:** T-19 the Compose profile installs a complete factory with one command ([#134](https://github.com/sesigl/open-software-factory/issues/134)) ([4a10330](https://github.com/sesigl/open-software-factory/commit/4a103303cf00df906a1cf632f000eec749011147))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/factory-spec-v0.3.0...factory-spec-v0.4.0) (2026-10-24)


### Features

* **factory-spec:** T-15 webhooks of forgejo and github automations through the forge port ([#105](https://github.com/sesigl/open-software-factory/issues/105)) ([ba795ad](https://github.com/sesigl/open-software-factory/commit/ba795ad58af71f66174310c1e580d98593139564))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/factory-spec-v0.2.0...factory-spec-v0.3.0) (2026-10-23)


### Features

* **sandbox:** T-13 the kubernetes adapter, env and OpenBao secrets, and render --k8s SandboxTemplates ([#97](https://github.com/sesigl/open-software-factory/issues/97)) ([d43ab12](https://github.com/sesigl/open-software-factory/commit/d43ab12203ef984e3a24f02f3ae6f01f8250c9b7))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/factory-spec-v0.1.0...factory-spec-v0.2.0) (2026-10-21)


### Features

* **tools:** mutation testing and duplication limits for every module (ADR 0037) ([#59](https://github.com/sesigl/open-software-factory/issues/59)) ([f62849e](https://github.com/sesigl/open-software-factory/commit/f62849ee318038dc4a0a84b6b3303528c3368f9e))

## 0.1.0 (2026-10-19)


### Features

* **factory-spec:** T-03 forge webhooks, render --k8s and --gh-aw, and a release ([#22](https://github.com/sesigl/open-software-factory/issues/22)) ([9da31e0](https://github.com/sesigl/open-software-factory/commit/9da31e04cbbe40dba07756aed123d9801b403431))
* **factory-spec:** T-03 lint, render, plan, apply, diff and resolve ([#20](https://github.com/sesigl/open-software-factory/issues/20)) ([657172c](https://github.com/sesigl/open-software-factory/commit/657172c60360156b9a7881c7224e621142f13414))
