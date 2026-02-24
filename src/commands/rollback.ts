import { Command } from "commander";
import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";
import { listBackups, restoreBackup } from "../lib/backup";

export const rollbackCommand = new Command("rollback")
  .description("Restore Claude Code config from a backup")
  .option("--claude-dir <dir>", "Claude config directory", join(homedir(), ".claude"))
  .action(async (opts) => {
    const claudeDir = opts.claudeDir;
    const backups = await listBackups(claudeDir);

    if (backups.length === 0) {
      console.log(chalk.yellow("\n  No backups found.\n"));
      return;
    }

    console.log(chalk.bold(`\n  Available backups (${backups.length}):\n`));
    for (let i = 0; i < backups.length; i++) {
      const name = backups[i].split("/").pop()!;
      console.log(`    ${chalk.bold(`[${i + 1}]`)} ${name}`);
    }

    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((res) => rl.question(q, res));

    const choice = await ask(chalk.bold(`\n  Restore which backup? [1-${backups.length}]: `));
    rl.close();

    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= backups.length) {
      console.log(chalk.red("  Invalid choice.\n"));
      return;
    }

    console.log(chalk.dim("\n  Restoring..."));
    await restoreBackup(backups[idx], claudeDir);
    console.log(chalk.bold.green("  Restored successfully!\n"));
  });
