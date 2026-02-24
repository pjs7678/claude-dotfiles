import { cp, readdir, mkdir } from "fs/promises";
import { join } from "path";

const BACKUP_PREFIX = "claude-dotfiles-";

export async function createBackup(claudeDir: string): Promise<string> {
  const backupRoot = join(claudeDir, "backups");
  await mkdir(backupRoot, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupRoot, `${BACKUP_PREFIX}${timestamp}`);
  await mkdir(backupPath, { recursive: true });

  const filesToBackup = ["settings.json", "settings.local.json"];
  for (const file of filesToBackup) {
    try {
      await cp(join(claudeDir, file), join(backupPath, file));
    } catch {
      // file may not exist, skip
    }
  }

  try {
    await mkdir(join(backupPath, "plugins"), { recursive: true });
    await cp(
      join(claudeDir, "plugins", "installed_plugins.json"),
      join(backupPath, "plugins", "installed_plugins.json")
    );
  } catch {
    // may not exist
  }

  try {
    await cp(join(claudeDir, "skills"), join(backupPath, "skills"), { recursive: true });
  } catch {
    // may not exist
  }

  return backupPath;
}

export async function listBackups(claudeDir: string): Promise<string[]> {
  const backupRoot = join(claudeDir, "backups");
  try {
    const entries = await readdir(backupRoot, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name.startsWith(BACKUP_PREFIX))
      .map((e) => join(backupRoot, e.name))
      .sort();
  } catch {
    return [];
  }
}

export async function restoreBackup(backupPath: string, claudeDir: string): Promise<void> {
  const filesToRestore = ["settings.json", "settings.local.json"];
  for (const file of filesToRestore) {
    try {
      await cp(join(backupPath, file), join(claudeDir, file));
    } catch {
      // file may not exist in backup
    }
  }

  try {
    await cp(
      join(backupPath, "plugins", "installed_plugins.json"),
      join(claudeDir, "plugins", "installed_plugins.json")
    );
  } catch {
    // may not exist
  }

  try {
    await cp(join(backupPath, "skills"), join(claudeDir, "skills"), { recursive: true });
  } catch {
    // may not exist
  }
}
