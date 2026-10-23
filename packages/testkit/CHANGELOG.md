# Changelog

## [0.14.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.13.0...testkit-v0.14.0) (2026-10-23)


### Features

* **harness:** T-12 the proxy library and the claude-code adapter ([#89](https://github.com/sesigl/open-software-factory/issues/89)) ([4774d88](https://github.com/sesigl/open-software-factory/commit/4774d88ede816b50bbd7e72dd639cbde7a2ea48a))

## [0.13.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.12.0...testkit-v0.13.0) (2026-10-23)


### Features

* **harness:** T-12 harness port as ACP on stdio and the generic acp adapter ([#87](https://github.com/sesigl/open-software-factory/issues/87)) ([17d983d](https://github.com/sesigl/open-software-factory/commit/17d983d1c669e9ac1820daa3a1e373d7bd873953))

## [0.12.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.11.0...testkit-v0.12.0) (2026-10-23)


### Features

* **gatekeeper:** T-11 gatekeeper serve with an HTTP API, Slack events and buttons, and a Postgres outbox ([#84](https://github.com/sesigl/open-software-factory/issues/84)) ([d58cfca](https://github.com/sesigl/open-software-factory/commit/d58cfca8009733ff168580fb335a5cbaddf371c3))

## [0.11.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.10.0...testkit-v0.11.0) (2026-10-22)


### Features

* **gatekeeper:** T-11 approvals by a Rego policy in Slack and pull requests, signed records (ADR 0047) ([#82](https://github.com/sesigl/open-software-factory/issues/82)) ([269f633](https://github.com/sesigl/open-software-factory/commit/269f633e78a09675cb14b1f876519962975de7b5))

## [0.10.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.9.0...testkit-v0.10.0) (2026-10-22)


### Features

* **observer:** T-10 group failed scores into problems, propose fixes as pull requests, check the effect (ADR 0046) ([#79](https://github.com/sesigl/open-software-factory/issues/79)) ([0f2cf5a](https://github.com/sesigl/open-software-factory/commit/0f2cf5a11d07f827bebba03774dc079d423d78c2))

## [0.9.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.8.0...testkit-v0.9.0) (2026-10-22)


### Features

* **spec-files:** one library reads feature files and JUnit reports (ADR 0042) ([#67](https://github.com/sesigl/open-software-factory/issues/67)) ([13e53ec](https://github.com/sesigl/open-software-factory/commit/13e53ec857de9753527de491427938298cdb9b9e))
* **taskcapture:** T-09 capture merged pull requests as Harbor tasks, report correctness against cost, route with LiteLLM (ADR 0043) ([#68](https://github.com/sesigl/open-software-factory/issues/68)) ([dd0ee7d](https://github.com/sesigl/open-software-factory/commit/dd0ee7d3286907374e907fc5fbfbbe57185abd48))

## [0.8.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.7.0...testkit-v0.8.0) (2026-10-21)


### Features

* **cli:** shared libraries for the command line and run records (ADR 0039, 0040, 0041) ([#65](https://github.com/sesigl/open-software-factory/issues/65)) ([5f49dd9](https://github.com/sesigl/open-software-factory/commit/5f49dd9921d5dd086e53ab5c0359e2d4f8f3a1d2))

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.6.0...testkit-v0.7.0) (2026-10-21)


### Features

* **tools:** mutation testing and duplication limits for every module (ADR 0037) ([#59](https://github.com/sesigl/open-software-factory/issues/59)) ([f62849e](https://github.com/sesigl/open-software-factory/commit/f62849ee318038dc4a0a84b6b3303528c3368f9e))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.5.0...testkit-v0.6.0) (2026-10-21)


### Features

* **scorekit:** T-07 score, calibrate, report and push agent sessions with LLM judges ([#49](https://github.com/sesigl/open-software-factory/issues/49)) ([17f48ef](https://github.com/sesigl/open-software-factory/commit/17f48ef5f65f7d05edc67c04228efa08f1d9db22))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.4.0...testkit-v0.5.0) (2026-10-21)


### Features

* **spec-trace:** T-06 GitHub Action, changes since a base commit, and CI runs spec-trace ([#47](https://github.com/sesigl/open-software-factory/issues/47)) ([d414e83](https://github.com/sesigl/open-software-factory/commit/d414e839fa647bda72906dff7c29abc4e19310ca))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.3.0...testkit-v0.4.0) (2026-10-20)


### Features

* **proof:** T-05 capture a running product, the GitHub Action and a proof check on every pull request ([#43](https://github.com/sesigl/open-software-factory/issues/43)) ([f7ebe7d](https://github.com/sesigl/open-software-factory/commit/f7ebe7d9e653dd367722f3a85462e556617a9524))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.2.0...testkit-v0.3.0) (2026-10-20)


### Features

* **runlog:** T-04 Collector config pack per harness, proven against a real Collector ([#37](https://github.com/sesigl/open-software-factory/issues/37)) ([2385f7f](https://github.com/sesigl/open-software-factory/commit/2385f7f8c016cdb74f515e4f07c54bf016c89d94))
* **runlog:** T-04 export Claude Code and Codex sessions as OTLP run records ([#27](https://github.com/sesigl/open-software-factory/issues/27)) ([8052725](https://github.com/sesigl/open-software-factory/commit/80527254aacf82e9be5a7b5d92557cf7fe5a8897))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/testkit-v0.1.0...testkit-v0.2.0) (2026-10-19)


### Features

* **factory-spec:** T-03 lint, render, plan, apply, diff and resolve ([#20](https://github.com/sesigl/open-software-factory/issues/20)) ([657172c](https://github.com/sesigl/open-software-factory/commit/657172c60360156b9a7881c7224e621142f13414))

## 0.1.0 (2026-10-19)


### Features

* **checks:** REACH from coverage of the running module; T-02 done ([#19](https://github.com/sesigl/open-software-factory/issues/19)) ([82c4911](https://github.com/sesigl/open-software-factory/commit/82c49110ee44392d5577b2f6e28576c9cb2a36e3))
* **contracts:** T-01 shared formats, npm publishing as [@opensoftware](https://github.com/opensoftware), no development gates ([#2](https://github.com/sesigl/open-software-factory/issues/2)) ([953bb2f](https://github.com/sesigl/open-software-factory/commit/953bb2ff68051943f91e85cb955b32744a0917b8))
* **repo:** T-00 repository tooling and checks ([#1](https://github.com/sesigl/open-software-factory/issues/1)) ([f2981ca](https://github.com/sesigl/open-software-factory/commit/f2981ca6df7069ac711e4f8cd5b1709163d382bb))
* **testkit:** NOREAL and BOUNDARY-RUNTIME guards, and a release setup ([#17](https://github.com/sesigl/open-software-factory/issues/17)) ([4d4b8df](https://github.com/sesigl/open-software-factory/commit/4d4b8dfe96860e9ee5c8b811cc9e876f58c112d1))
* **testkit:** scripted ACP harness and the conformance runner ([#16](https://github.com/sesigl/open-software-factory/issues/16)) ([2f00473](https://github.com/sesigl/open-software-factory/commit/2f0047348c796ec05922291781880a384a990d40))
* **testkit:** service fakes and the http, mcp and events surfaces ([#15](https://github.com/sesigl/open-software-factory/issues/15)) ([ef23e15](https://github.com/sesigl/open-software-factory/commit/ef23e1582fb4b6dfdc80b7a69df2c601ca53d0c5))
* **testkit:** T-02 drive a module: sut.readme, fixed clock and seed, scripted model gateway, working template ([#14](https://github.com/sesigl/open-software-factory/issues/14)) ([cbd81b1](https://github.com/sesigl/open-software-factory/commit/cbd81b1b6059195355f787bf30e77d0ce6955d86))
* **testkit:** T-02 sut.files refuses paths outside $INPUT and $OUTPUT ([#12](https://github.com/sesigl/open-software-factory/issues/12)) ([8221a09](https://github.com/sesigl/open-software-factory/commit/8221a097c6a46081faf9cbb26816f99eb253d9ab))
* **testkit:** T-02 testkit run writes JUnit results that carry the scenario ID ([#11](https://github.com/sesigl/open-software-factory/issues/11)) ([d68c655](https://github.com/sesigl/open-software-factory/commit/d68c6551bd697370876a327bb0fde85522f11b30))
* **tools:** T-02 declared module layers and the ARCH check ([#13](https://github.com/sesigl/open-software-factory/issues/13)) ([fd09566](https://github.com/sesigl/open-software-factory/commit/fd095660c03c12f73bed28e2e8ac0e2d50b271d6))
