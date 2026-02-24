import { Command } from "commander";
import chalk from "chalk";
import { searchRepos } from "../lib/github";
import { renderSearchResult } from "../lib/renderer";

export const searchCommand = new Command("search")
  .description("Search for Claude Code setups on GitHub")
  .argument("[query]", "Search query")
  .action(async (query?: string) => {
    console.log(chalk.dim("\n  Searching GitHub for Claude Code setups...\n"));

    const results = await searchRepos(query);

    if (results.length === 0) {
      console.log(chalk.yellow("  No setups found."));
      if (!query) {
        console.log(chalk.dim("  Be the first! Run `claude-dotfiles init` to share your setup.\n"));
      }
      return;
    }

    console.log(chalk.bold(`  Found ${results.length} setup(s):\n`));

    for (const result of results) {
      const author = result.fullName.split("/")[0] ?? "unknown";
      console.log(
        renderSearchResult({
          author,
          name: result.fullName,
          description: result.description ?? "No description",
          tags: [],
          url: result.url,
        })
      );
      console.log("");
    }
  });
