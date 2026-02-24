import { readFile, readdir, access } from "fs/promises";
import { join } from "path";
import type { ScanResult, PluginEntry } from "../types";

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

  return { settings, permissions, plugins, skills, claudeMdFiles: [] };
}
