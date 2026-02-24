import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { scanClaudeDir } from "../src/lib/scanner";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, ".test-claude");

function setupTestDir() {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, "plugins"), { recursive: true });
  mkdirSync(join(TEST_DIR, "skills", "my-skill"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, "settings.json"),
    JSON.stringify({
      statusLine: { type: "command", command: "echo hi" },
      enabledPlugins: { "superpowers@official": true },
    })
  );

  writeFileSync(
    join(TEST_DIR, "settings.local.json"),
    JSON.stringify({
      permissions: { allow: ["Bash(ls:*)"] },
    })
  );

  writeFileSync(
    join(TEST_DIR, "plugins", "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        "superpowers@official": [
          { scope: "user", version: "4.3.1", installPath: "/fake", installedAt: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-01T00:00:00Z", gitCommitSha: "abc123" },
        ],
      },
    })
  );

  writeFileSync(join(TEST_DIR, "skills", "my-skill", "SKILL.md"), "# My Skill");
}

describe("scanClaudeDir", () => {
  beforeEach(() => setupTestDir());
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("reads settings.json", async () => {
    const result = await scanClaudeDir(TEST_DIR);
    expect(result.settings).not.toBeNull();
    expect(result.settings?.enabledPlugins).toBeDefined();
  });

  test("reads permissions from settings.local.json", async () => {
    const result = await scanClaudeDir(TEST_DIR);
    expect(result.permissions).not.toBeNull();
    expect(result.permissions?.allow).toContain("Bash(ls:*)");
  });

  test("reads installed plugins", async () => {
    const result = await scanClaudeDir(TEST_DIR);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0].name).toBe("superpowers");
    expect(result.plugins[0].marketplace).toBe("official");
    expect(result.plugins[0].version).toBe("4.3.1");
  });

  test("finds custom skills", async () => {
    const result = await scanClaudeDir(TEST_DIR);
    expect(result.skills).toContain("my-skill");
  });

  test("handles missing files gracefully", async () => {
    const emptyDir = join(TEST_DIR, "empty");
    mkdirSync(emptyDir, { recursive: true });
    const result = await scanClaudeDir(emptyDir);
    expect(result.settings).toBeNull();
    expect(result.permissions).toBeNull();
    expect(result.plugins).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
  });
});
