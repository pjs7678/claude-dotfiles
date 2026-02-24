import { Command } from "commander";
import chalk from "chalk";
import { access } from "fs/promises";
import { join } from "path";
import { $ } from "bun";
import { createRepo, addTopic, pushToGithub } from "../lib/github";

export const publishCommand = new Command("publish")
  .description("Publish your Claude Code setup to GitHub")
  .option("-d, --dir <dir>", "Directory containing exported setup", ".")
  .action(async (opts) => {
    const dir = opts.dir;

    const manifestPath = join(dir, "claude-dotfiles.json");
    try {
      await access(manifestPath);
    } catch {
      console.error(chalk.red("\n  No claude-dotfiles.json found."));
      console.error(chalk.dim("  Run `claude-dotfiles init` first.\n"));
      process.exit(1);
    }

    const manifest = JSON.parse(await Bun.file(manifestPath).text());

    console.log(chalk.bold(`\n  Publishing "${manifest.name}"...\n`));

    const isGitRepo = await $`git -C ${dir} rev-parse --git-dir`.quiet().nothrow();
    if (isGitRepo.exitCode !== 0) {
      console.log(chalk.dim("  Initializing git repo..."));
      await $`git -C ${dir} init`;
      await $`git -C ${dir} add -A`;
      await $`git -C ${dir} commit -m "Initial claude-dotfiles export"`;
    }

    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((res) => rl.question(q, res));

    const repoName = await ask(chalk.bold("  GitHub repo name (e.g. my-claude-dotfiles): "));
    rl.close();

    console.log(chalk.dim(`  Creating GitHub repo: ${repoName}...`));
    const repoUrl = await createRepo(repoName, manifest.description);
    console.log(chalk.dim(`  Created: ${repoUrl}`));

    const ghUser = (await $`gh api user --jq .login`.text()).trim();
    const fullRepo = `${ghUser}/${repoName}`;

    console.log(chalk.dim("  Pushing to GitHub..."));
    await pushToGithub(dir, fullRepo);

    console.log(chalk.dim("  Adding claude-dotfiles topic..."));
    await addTopic(fullRepo);

    console.log(chalk.bold.green(`\n  Published successfully!`));
    console.log(`  ${chalk.underline.blue(`https://github.com/${fullRepo}`)}`);
    console.log(chalk.dim(`\n  Others can install with: claude-dotfiles install ${fullRepo}\n`));
  });
