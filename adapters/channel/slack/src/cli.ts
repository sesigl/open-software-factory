#!/usr/bin/env node
// channel-slack <command>: the channel port's commands on Slack; channel-kit reads the command line (ADR 0059).
import { runChannel } from "@opensoftware/channel-kit";
import { slack } from "./adapters/slack.ts";

process.exitCode = await runChannel(slack);
