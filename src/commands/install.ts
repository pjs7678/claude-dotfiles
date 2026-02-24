import { Command } from "commander";
import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir, cp } from "fs/promises";
import { cloneRepo, fetchManifest } from "../lib/github";
import { validateManifest } from "../lib/manifest";
import { renderManifest } from "../lib/renderer";
import { createBackup } from "../lib/backup";
import { mergeSettings, mergePermissions } from "../lib/merger";
import { scanClaudeDir } from "../lib/scanner";
import type { PluginEntry } from "../types";
import { tmpdir } from "os";

export const installCommand = new Command("install")
  .description("Install a Claude Code setup from GitHub")
  .argument("<repo>", "GitHub repo (user/repo)")
  .option("--claude-dir <dir>", "Claude config directory", join(homedir(), ".claude"))
  .option("--dry-run", "Show what would change without applying", false)
  .action(async (repo: string, opts) => {
    const claudeDir = opts.claudeDir;

    console.log(chalk.dim(`\n  Fetching setup from ${repo}...\n`));

    const raw = await fetchManifest(repo);
    const validation = validateManifest(raw);
    if (!validation.success) {
      console.error(chalk.red(`  Invalid manifest: ${validation.error}`));
      process.exit(1);
    }
    const manifest = validation.data!;
    console.log(renderManifest(manifest));
    console.log("");

    const tempDir = join(tmpdir(), `claude-dotfiles-${Date.now()}`);
    await cloneRepo(repo, tempDir);

    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((res) => rl.question(q, res));

    const components: string[] = [];
    const c = manifest.components;

    if (c.plugins?.include) {
      const ans = await ask(chalk.bold("  Install plugins? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("plugins");
    }
    if (c.settings?.include) {
      const ans = await ask(chalk.bold("  Merge settings? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("settings");
    }
    if (c.permissions?.include) {
      const ans = await ask(chalk.bold("  Merge permissions? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("permissions");
    }
    if (c.skills?.include) {
      const ans = await ask(chalk.bold("  Install skills? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("skills");
    }
    if (c.claudeMd?.include) {
      const ans = await ask(chalk.bold("  Install CLAUDE.md templates? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("claudeMd");
    }
    rl.close();

    if (components.length === 0) {
      console.log(chalk.yellow("\n  No components selected. Nothing to install.\n"));
      return;
    }

    if (opts.dryRun) {
      console.log(chalk.yellow("\n  Dry run — would install:"));
      for (const comp of components) {
        console.log(`    ${chalk.green("+")} ${comp}`);
      }
      console.log("");
      return;
    }

    console.log(chalk.dim("\n  Creating backup..."));
    const backupPath = await createBackup(claudeDir);
    console.log(chalk.dim(`  Backup saved to: ${backupPath}\n`));

    if (components.includes("settings") && c.settings) {
      console.log(chalk.bold("  Merging settings..."));
      const remoteSettings = JSON.parse(
        await readFile(join(tempDir, c.settings.file), "utf-8")
      );
      const localSettingsPath = join(claudeDir, "settings.json");
      let localSettings: Record<string, any> = {};
      try {
        localSettings = JSON.parse(await readFile(localSettingsPath, "utf-8"));
      } catch {
        // no existing settings
      }
      const { merged, conflicts } = mergeSettings(localSettings, remoteSettings);
      await writeFile(localSettingsPath, JSON.stringify(merged, null, 2));
      if (conflicts.length > 0) {
        console.log(chalk.yellow(`    ${conflicts.length} conflict(s) — existing values kept:`));
        for (const conf of conflicts) {
          console.log(`      ${chalk.dim(conf)}`);
        }
      }
      console.log(chalk.green("    Done."));
    }

    if (components.includes("permissions") && c.permissions) {
      console.log(chalk.bold("  Merging permissions..."));
      const remotePerms = JSON.parse(
        await readFile(join(tempDir, c.permissions.file), "utf-8")
      );
      const localPermsPath = join(claudeDir, "settings.local.json");
      let localPermsFile: Record<string, any> = {};
      try {
        localPermsFile = JSON.parse(await readFile(localPermsPath, "utf-8"));
      } catch {
        // no existing
      }
      const localPerms = localPermsFile.permissions ?? { allow: [] };
      const merged = mergePermissions(localPerms, remotePerms);
      localPermsFile.permissions = merged;
      await writeFile(localPermsPath, JSON.stringify(localPermsFile, null, 2));
      const newCount = merged.allow.length - (localPerms.allow?.length ?? 0);
      console.log(chalk.green(`    Done. Added ${newCount} new permission rule(s).`));
    }

    if (components.includes("plugins") && c.plugins) {
      console.log(chalk.bold("  Installing plugins..."));
      const remotePlugins: PluginEntry[] = JSON.parse(
        await readFile(join(tempDir, c.plugins.file), "utf-8")
      );
      const local = await scanClaudeDir(claudeDir);
      const localNames = local.plugins.map((p) => `${p.name}@${p.marketplace}`);
      const newPlugins = remotePlugins.filter(
        (p) => !localNames.includes(`${p.name}@${p.marketplace}`)
      );
      if (newPlugins.length === 0) {
        console.log(chalk.dim("    All plugins already installed."));
      } else {
        for (const p of newPlugins) {
          console.log(`    ${chalk.yellow("TODO:")} Run 'claude plugin install ${p.name}@${p.marketplace}'`);
        }
      }
    }

    if (components.includes("skills") && c.skills) {
      console.log(chalk.bold("  Installing skills..."));
      const skillsSrc = join(tempDir, c.skills.dir);
      const skillsDest = join(claudeDir, "skills");
      await mkdir(skillsDest, { recursive: true });
      await cp(skillsSrc, skillsDest, { recursive: true });
      console.log(chalk.green("    Done."));
    }

    if (components.includes("claudeMd") && c.claudeMd) {
      console.log(chalk.bold("  Installing CLAUDE.md templates..."));
      const mdSrc = join(tempDir, c.claudeMd.dir);
      const mdDest = join(claudeDir, "claude-md-imports");
      await mkdir(mdDest, { recursive: true });
      await cp(mdSrc, mdDest, { recursive: true });
      console.log(chalk.green(`    Done. Templates saved to ${mdDest}`));
    }

    console.log(chalk.bold.green("\n  Installation complete!"));
    console.log(chalk.dim(`  Run 'claude-dotfiles rollback' to undo.\n`));
  });
