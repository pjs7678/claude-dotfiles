import chalk from "chalk";
import type { Manifest, PluginEntry } from "../types";

export function renderManifest(manifest: Manifest): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan(`  ${manifest.name}`));
  lines.push(chalk.dim(`  ${manifest.description}`));
  lines.push(chalk.dim(`  by ${manifest.author} | v${manifest.version}`));
  if (manifest.tags.length > 0) {
    lines.push(`  ${manifest.tags.map((t) => chalk.bgBlue.white(` ${t} `)).join(" ")}`);
  }
  lines.push("");

  const c = manifest.components;
  lines.push(chalk.bold("  Components:"));
  if (c.plugins?.include) lines.push(`    ${chalk.green("+")} Plugins      ${chalk.dim(c.plugins.file)}`);
  if (c.settings?.include) lines.push(`    ${chalk.green("+")} Settings     ${chalk.dim(c.settings.file)}`);
  if (c.permissions?.include) lines.push(`    ${chalk.green("+")} Permissions  ${chalk.dim(c.permissions.file)}`);
  if (c.skills?.include) lines.push(`    ${chalk.green("+")} Skills       ${chalk.dim(c.skills.dir)}`);
  if (c.claudeMd?.include) lines.push(`    ${chalk.green("+")} CLAUDE.md    ${chalk.dim(c.claudeMd.dir)}`);

  return lines.join("\n");
}

export function renderPluginList(plugins: PluginEntry[], installedPlugins?: string[]): string {
  const lines: string[] = [];
  lines.push(chalk.bold("  Plugins:"));
  for (const p of plugins) {
    const installed = installedPlugins?.includes(`${p.name}@${p.marketplace}`);
    const marker = installed ? chalk.green(" (installed)") : chalk.yellow(" (new)");
    lines.push(`    ${chalk.white(p.name)}@${chalk.dim(p.marketplace)} v${p.version}${marker}`);
  }
  return lines.join("\n");
}

export function renderDiff(label: string, added: string[], existing: string[]): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`  ${label}:`));
  lines.push(chalk.dim(`    ${existing.length} already installed, ${added.length} new`));
  for (const item of added) {
    lines.push(`    ${chalk.green("+")} ${item}`);
  }
  return lines.join("\n");
}

export function renderSearchResult(result: { author: string; name: string; description: string; tags: string[]; url: string }): string {
  const lines: string[] = [];
  lines.push(`  ${chalk.bold.cyan(result.name)} ${chalk.dim(`by ${result.author}`)}`);
  lines.push(`  ${result.description}`);
  if (result.tags.length > 0) {
    lines.push(`  ${result.tags.map((t) => chalk.dim(`#${t}`)).join(" ")}`);
  }
  lines.push(`  ${chalk.underline.blue(result.url)}`);
  return lines.join("\n");
}
