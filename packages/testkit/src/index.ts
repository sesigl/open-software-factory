// @opensoftware/testkit: the only way system tests touch a module. Layers: see ../architecture.json.
export type { Collector } from "./fakes/collector.ts";
export type { Fakes } from "./fakes/fakes.ts";
export type { Forge, Issue, OpenedPullRequest, PullRequest } from "./fakes/forge.ts";
export type { FakeGitHub, GitHubComment } from "./fakes/github.ts";
export type {
  Harness,
  HarnessCommand,
  HarnessOptions,
  HarnessSession,
  HarnessTool,
  HarnessToolCall,
  HarnessTurn,
} from "./fakes/harness.ts";
export type { FakeHttp, HttpOptions, HttpRequest, HttpRoute } from "./fakes/http.ts";
export type { Inference, InferenceOptions } from "./fakes/inference.ts";
export type { ModelGateway, ScriptedReply, ScriptedTool } from "./fakes/model-gateway.ts";
export type { Postgres } from "./fakes/postgres.ts";
export type { Sandbox, SandboxExec, SandboxOptions, SandboxSpec } from "./fakes/sandbox.ts";
export type { FakeSentry, SentryAlert } from "./fakes/sentry.ts";
export type { Nats, S3, Temporal } from "./fakes/services.ts";
export type { FakeSlack, SlackMessage, SlackOptions } from "./fakes/slack.ts";
export { type ScenarioContext, type StepFn, scenario } from "./scenario.ts";
export type { CliResult } from "./support/process.ts";
export type { Acp, AcpClient, AcpPermissionRequest, AcpSession, AcpStreams, AcpTurn } from "./sut/acp.ts";
export type { Action, ActionOptions, ActionResult } from "./sut/action.ts";
export type { Compose, ComposeService } from "./sut/compose.ts";
export type { CloudEvent, EventLog, Events } from "./sut/events.ts";
export type { Helm } from "./sut/helm.ts";
export type { Http, HttpResponse } from "./sut/http.ts";
export type { Mcp, McpClient } from "./sut/mcp.ts";
export type { Sut } from "./sut/sut.ts";
