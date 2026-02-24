import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createBackup, restoreBackup, listBackups } from "../src/lib/backup";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, ".test-claude-backup");

function setupTestDir() {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, "settings.json"), '{"key":"original"}');
  writeFileSync(join(TEST_DIR, "settings.local.json"), '{"permissions":{}}');
}

describe("backup", () => {
  beforeEach(() => setupTestDir());
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("creates a backup with timestamp", async () => {
    const backupPath = await createBackup(TEST_DIR);
    expect(backupPath).toContain("claude-dotfiles-");
    const content = readFileSync(join(backupPath, "settings.json"), "utf-8");
    expect(content).toContain("original");
  });

  test("lists backups sorted by date", async () => {
    await createBackup(TEST_DIR);
    await new Promise((r) => setTimeout(r, 10));
    await createBackup(TEST_DIR);
    const backups = await listBackups(TEST_DIR);
    expect(backups.length).toBe(2);
  });

  test("restores from backup", async () => {
    const backupPath = await createBackup(TEST_DIR);
    writeFileSync(join(TEST_DIR, "settings.json"), '{"key":"modified"}');
    await restoreBackup(backupPath, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, "settings.json"), "utf-8");
    expect(content).toContain("original");
  });
});
