#!/usr/bin/env bun
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { showCommand } from "./commands/show";
import { searchCommand } from "./commands/search";
import { installCommand } from "./commands/install";
import { publishCommand } from "./commands/publish";
import { rollbackCommand } from "./commands/rollback";

const program = new Command();

program
  .name("claude-dotfiles")
  .description("Share, discover, and install Claude Code configurations")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(showCommand);
program.addCommand(searchCommand);
program.addCommand(installCommand);
program.addCommand(publishCommand);
program.addCommand(rollbackCommand);

program.parse();
