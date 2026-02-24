import { Command } from "commander";
import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";
import { fetchManifest, fetchFile } from "../lib/github";
import { validateManifest } from "../lib/manifest";
import { renderManifest, renderPluginList } from "../lib/renderer";
import { scanClaudeDir } from "../lib/scanner";
import type { PluginEntry } from "../types";

export const showCommand = new Command("show")
  .description("Preview a Claude Code setup from GitHub")
  .argument("<repo>", "GitHub repo (user/repo)")
  .option("--claude-dir <dir>", "Claude config directory", join(homedir(), ".claude"))
  .action(async (repo: string, opts) => {
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

    if (manifest.components.plugins?.include) {
      const pluginsJson = await fetchFile(repo, manifest.components.plugins.file);
      const remotePlugins: PluginEntry[] = JSON.parse(pluginsJson);

      const local = await scanClaudeDir(opts.claudeDir);
      const localNames = local.plugins.map((p) => `${p.name}@${p.marketplace}`);

      console.log(renderPluginList(remotePlugins, localNames));
      console.log("");
    }

    if (manifest.components.skills?.include) {
      console.log(chalk.bold("  Skills:"));
      console.log(chalk.dim(`    (in ${manifest.components.skills.dir})`));
      console.log("");
    }

    if (manifest.components.claudeMd?.include) {
      console.log(chalk.bold("  CLAUDE.md templates:"));
      console.log(chalk.dim(`    (in ${manifest.components.claudeMd.dir})`));
      console.log("");
    }

    console.log(chalk.dim(`  To install: claude-dotfiles install ${repo}\n`));
  });
