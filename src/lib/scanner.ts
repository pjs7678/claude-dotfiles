import { readFile, readdir, access } from "fs/promises";
import { join } from "path";
import type { ScanResult, PluginEntry, PluginSkillGroup, PluginSkillEntry } from "../types";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path: string): Promise<unknown | null> {
  if (!(await fileExists(path))) return null;
  const content = await readFile(path, "utf-8");
  return JSON.parse(content);
}

export async function scanClaudeDir(claudeDir: string): Promise<ScanResult> {
  const settingsRaw = (await readJson(join(claudeDir, "settings.json"))) as Record<string, unknown> | null;
  const localRaw = (await readJson(join(claudeDir, "settings.local.json"))) as Record<string, unknown> | null;
  const pluginsRaw = (await readJson(join(claudeDir, "plugins", "installed_plugins.json"))) as Record<string, unknown> | null;

  const permissions = localRaw?.permissions
    ? (localRaw.permissions as { allow: string[] })
    : null;

  const settings = settingsRaw;

  const plugins: PluginEntry[] = [];
  if (pluginsRaw?.plugins) {
    const pluginsMap = pluginsRaw.plugins as Record<string, Array<{ version: string }>>;
    for (const [fullName, entries] of Object.entries(pluginsMap)) {
      const atIdx = fullName.lastIndexOf("@");
      const name = atIdx > 0 ? fullName.slice(0, atIdx) : fullName;
      const marketplace = atIdx > 0 ? fullName.slice(atIdx + 1) : "unknown";
      const version = entries[0]?.version ?? "unknown";
      plugins.push({ name, marketplace, version });
    }
  }

  const skills: string[] = [];
  const skillsDir = join(claudeDir, "skills");
  if (await fileExists(skillsDir)) {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        skills.push(entry.name);
      }
    }
  }

  const pluginSkills = await scanPluginSkills(claudeDir);

  return { settings, permissions, plugins, skills, claudeMdFiles: [], pluginSkills };
}

export function parseSkillFrontmatter(content: string): PluginSkillEntry | null {
  if (!content.startsWith("---\n")) return null;
  const endIdx = content.indexOf("\n---", 3);
  if (endIdx === -1) return null;

  const frontmatter = content.slice(4, endIdx);
  let name: string | null = null;
  let description: string | null = null;

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === "name") name = value;
    if (key === "description") description = value;
  }

  if (!name || !description) return null;
  return { name, description };
}

export async function scanPluginSkills(claudeDir: string): Promise<PluginSkillGroup[]> {
  const pluginsJsonPath = join(claudeDir, "plugins", "installed_plugins.json");
  const pluginsRaw = (await readJson(pluginsJsonPath)) as Record<string, unknown> | null;
  if (!pluginsRaw?.plugins) return [];

  const groups: PluginSkillGroup[] = [];
  const pluginsMap = pluginsRaw.plugins as Record<string, Array<{ version: string; installPath: string }>>;

  for (const [fullName, entries] of Object.entries(pluginsMap)) {
    const entry = entries[0];
    if (!entry?.installPath) continue;

    const skillsDir = join(entry.installPath, "skills");
    if (!(await fileExists(skillsDir))) continue;

    const atIdx = fullName.lastIndexOf("@");
    const pluginName = atIdx > 0 ? fullName.slice(0, atIdx) : fullName;
    const marketplace = atIdx > 0 ? fullName.slice(atIdx + 1) : "unknown";

    const skillEntries = await readdir(skillsDir, { withFileTypes: true });
    const skills: PluginSkillEntry[] = [];

    for (const skillEntry of skillEntries) {
      if (!skillEntry.isDirectory()) continue;
      const skillMdPath = join(skillsDir, skillEntry.name, "SKILL.md");
      if (!(await fileExists(skillMdPath))) continue;

      const content = await readFile(skillMdPath, "utf-8");
      const parsed = parseSkillFrontmatter(content);
      if (parsed) skills.push(parsed);
    }

    if (skills.length > 0) {
      groups.push({ plugin: pluginName, marketplace, version: entry.version, skills });
    }
  }

  return groups;
}
