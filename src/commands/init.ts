import { Command } from "commander";
import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";
import { writeFile, mkdir, cp } from "fs/promises";
import { scanClaudeDir } from "../lib/scanner";
import { sanitizeSettings, findSensitiveStrings, anonymizePaths } from "../lib/sanitizer";
import { generateManifest } from "../lib/manifest";
import { renderManifest } from "../lib/renderer";
import type { Manifest } from "../types";
import type { ScanResult } from "../types";

export const initCommand = new Command("init")
  .description("Export your current Claude Code setup")
  .option("-o, --output <dir>", "Output directory", ".")
  .option("--claude-dir <dir>", "Claude config directory", join(homedir(), ".claude"))
  .action(async (opts) => {
    const claudeDir = opts.claudeDir;
    const outputDir = opts.output;

    console.log(chalk.bold("\nScanning Claude Code configuration...\n"));

    const scan = await scanClaudeDir(claudeDir);

    console.log(chalk.bold("  Found:"));
    if (scan.settings) console.log(`    ${chalk.green("+")} Settings`);
    if (scan.permissions) console.log(`    ${chalk.green("+")} Permissions (${scan.permissions.allow.length} rules)`);
    console.log(`    ${chalk.green("+")} Plugins (${scan.plugins.length})`);
    for (const p of scan.plugins) {
      console.log(`      ${chalk.dim("-")} ${p.name}@${p.marketplace} v${p.version}`);
    }
    if (scan.skills.length > 0) {
      console.log(`    ${chalk.green("+")} Skills (${scan.skills.length})`);
      for (const s of scan.skills) {
        console.log(`      ${chalk.dim("-")} ${s}`);
      }
    }
    console.log("");

    if (scan.settings) {
      const warnings = findSensitiveStrings(scan.settings, homedir());
      if (warnings.length > 0) {
        console.log(chalk.yellow("  Sensitive paths detected (will be anonymized):"));
        for (const w of warnings) {
          console.log(`    ${chalk.yellow("!")} ${w}`);
        }
        console.log("");
      }
    }

    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((res) => rl.question(q, res));

    const name = await ask(chalk.bold("  Setup name: "));
    const description = await ask(chalk.bold("  Description: "));
    const author = await ask(chalk.bold("  Author: "));
    const tagsInput = await ask(chalk.bold("  Tags (comma-separated): "));
    rl.close();

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const manifest = generateManifest(scan, { name, description, author, tags });

    await mkdir(outputDir, { recursive: true });

    await writeFile(
      join(outputDir, "claude-dotfiles.json"),
      JSON.stringify(manifest, null, 2)
    );

    if (scan.settings) {
      let sanitized = sanitizeSettings(scan.settings);
      sanitized = anonymizePaths(sanitized, homedir());
      await writeFile(join(outputDir, "settings.json"), JSON.stringify(sanitized, null, 2));
    }

    if (scan.permissions) {
      await writeFile(join(outputDir, "permissions.json"), JSON.stringify(scan.permissions, null, 2));
    }

    if (scan.plugins.length > 0) {
      await writeFile(join(outputDir, "plugins.json"), JSON.stringify(scan.plugins, null, 2));
    }

    if (scan.skills.length > 0) {
      const skillsSrc = join(claudeDir, "skills");
      const skillsDest = join(outputDir, "skills");
      await mkdir(skillsDest, { recursive: true });
      for (const skill of scan.skills) {
        await cp(join(skillsSrc, skill), join(skillsDest, skill), { recursive: true });
      }
    }

    const readme = generateReadme(manifest, scan);
    await writeFile(join(outputDir, "README.md"), readme);

    console.log(chalk.bold.green("\n  Setup exported successfully!\n"));
    console.log(renderManifest(manifest));
    console.log(chalk.dim(`\n  Files written to: ${outputDir}`));
    console.log(chalk.dim("  Run `claude-dotfiles publish` to push to GitHub.\n"));
  });

function generateReadme(manifest: Manifest, scan: ScanResult): string {
  const lines: string[] = [];
  lines.push(`# ${manifest.name}`);
  lines.push("");
  lines.push(manifest.description);
  lines.push("");
  lines.push(`> by ${manifest.author}`);
  lines.push("");

  if (manifest.tags.length > 0) {
    lines.push(manifest.tags.map((t) => `\`${t}\``).join(" "));
    lines.push("");
  }

  lines.push("## Install");
  lines.push("");
  lines.push("```bash");
  lines.push(`claude-dotfiles install ${manifest.author}/claude-dotfiles`);
  lines.push("```");
  lines.push("");

  lines.push("## What's Included");
  lines.push("");

  if (scan.plugins.length > 0) {
    lines.push("### Plugins");
    lines.push("");
    for (const p of scan.plugins) {
      lines.push(`- **${p.name}** (${p.marketplace}) v${p.version}`);
    }
    lines.push("");
  }

  if (scan.skills.length > 0) {
    lines.push("### Custom Skills");
    lines.push("");
    for (const s of scan.skills) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  if (manifest.components.settings?.include) {
    lines.push("### Settings");
    lines.push("");
    lines.push("Custom Claude Code settings included (sensitive data stripped).");
    lines.push("");
  }

  if (manifest.components.permissions?.include) {
    lines.push("### Permissions");
    lines.push("");
    lines.push("Pre-configured permission rules for common tools.");
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*Generated with [claude-dotfiles](https://github.com/claude-dotfiles/claude-dotfiles)*");

  return lines.join("\n");
}
