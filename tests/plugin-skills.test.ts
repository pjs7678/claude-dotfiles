import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { PluginSkillGroupSchema } from "../src/types";
import { parseSkillFrontmatter, scanPluginSkills } from "../src/lib/scanner";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

describe("PluginSkillGroupSchema", () => {
  test("validates a valid plugin skill group", () => {
    const data = {
      plugin: "superpowers",
      marketplace: "claude-plugins-official",
      version: "4.3.1",
      skills: [
        { name: "brainstorming", description: "Use when starting any creative work" },
        { name: "test-driven-development", description: "Use when implementing any feature" },
      ],
    };
    const result = PluginSkillGroupSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test("rejects plugin skill group missing skills array", () => {
    const data = {
      plugin: "superpowers",
      marketplace: "claude-plugins-official",
      version: "4.3.1",
    };
    const result = PluginSkillGroupSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("parseSkillFrontmatter", () => {
  test("parses YAML frontmatter from SKILL.md content", () => {
    const content = `---
name: brainstorming
description: "Use when starting any creative work"
---

# Brainstorming
Some content here.`;
    const result = parseSkillFrontmatter(content);
    expect(result).toEqual({
      name: "brainstorming",
      description: "Use when starting any creative work",
    });
  });

  test("parses unquoted description", () => {
    const content = `---
name: test-skill
description: Use when testing things
---`;
    const result = parseSkillFrontmatter(content);
    expect(result).toEqual({
      name: "test-skill",
      description: "Use when testing things",
    });
  });

  test("returns null for content without frontmatter", () => {
    const content = "# No Frontmatter\nJust regular markdown.";
    const result = parseSkillFrontmatter(content);
    expect(result).toBeNull();
  });

  test("returns null when name or description is missing", () => {
    const content = `---
name: only-name
---`;
    const result = parseSkillFrontmatter(content);
    expect(result).toBeNull();
  });
});

const TEST_DIR = join(import.meta.dir, ".test-plugin-skills");

describe("scanPluginSkills", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, "plugins"), { recursive: true });
    const installPath = join(TEST_DIR, "plugins", "cache", "my-marketplace", "my-plugin", "1.0.0");
    writeFileSync(
      join(TEST_DIR, "plugins", "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: {
          "my-plugin@my-marketplace": [
            {
              scope: "user",
              version: "1.0.0",
              installPath,
              installedAt: "2026-01-01T00:00:00Z",
              lastUpdated: "2026-01-01T00:00:00Z",
              gitCommitSha: "abc123",
            },
          ],
        },
      })
    );
    const skillDir = join(installPath, "skills", "cool-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: cool-skill\ndescription: A cool skill for testing\n---\n# Cool Skill`
    );
  });

  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("scans plugin skills from installed plugins", async () => {
    const result = await scanPluginSkills(TEST_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].plugin).toBe("my-plugin");
    expect(result[0].marketplace).toBe("my-marketplace");
    expect(result[0].version).toBe("1.0.0");
    expect(result[0].skills).toHaveLength(1);
    expect(result[0].skills[0].name).toBe("cool-skill");
    expect(result[0].skills[0].description).toBe("A cool skill for testing");
  });

  test("returns empty array when no plugins have skills", async () => {
    rmSync(join(TEST_DIR, "plugins", "cache"), { recursive: true, force: true });
    const noSkillDir = join(TEST_DIR, "plugins", "cache", "m", "p", "1.0.0");
    mkdirSync(noSkillDir, { recursive: true });
    writeFileSync(
      join(TEST_DIR, "plugins", "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: {
          "p@m": [{ scope: "user", version: "1.0.0", installPath: noSkillDir, installedAt: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-01T00:00:00Z", gitCommitSha: "abc" }],
        },
      })
    );
    const result = await scanPluginSkills(TEST_DIR);
    expect(result).toHaveLength(0);
  });
});
