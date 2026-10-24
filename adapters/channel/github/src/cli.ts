#!/usr/bin/env node
// channel-github <command>: the channel port's commands in a pull request's conversation; channel-kit reads the
// command line (ADR 0059).
import { runChannel } from "@opensoftware/channel-kit";
import { github } from "./adapters/github.ts";

process.exitCode = await runChannel(github);
