#!/usr/bin/env bun
import { Command } from "commander";

const program = new Command();

program
  .name("claude-dotfiles")
  .description("Share, discover, and install Claude Code configurations")
  .version("0.1.0");

// Commands will be registered here as we build them

program.parse();
