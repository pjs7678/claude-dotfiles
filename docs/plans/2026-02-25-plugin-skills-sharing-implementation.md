# Plugin Skills Sharing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Export plugin skill metadata (names + descriptions) during `init` and display them in the `show` command, so users can discover what skills come with installed plugins.

**Architecture:** Extend the scanner to walk plugin cache directories and parse SKILL.md YAML frontmatter. Add new types, update manifest schema, modify `init` to export `plugin-skills.json`, and modify `show` + renderer to display plugin skills.

**Tech Stack:** TypeScript, Bun, Zod (schemas), chalk (rendering)

---

### Task 1: Add Types and Schemas

**Files:**
- Modify: `src/types.ts:1-37`

**Step 1: Write the failing test**

Create test file `tests/plugin-skills.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { PluginSkillGroupSchema } from "../src/types";

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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/plugin-skills.test.ts`
Expected: FAIL — `PluginSkillGroupSchema` is not exported from `src/types.ts`

**Step 3: Write minimal implementation**

Add to `src/types.ts` after the existing types:

```typescript
export const PluginSkillEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const PluginSkillGroupSchema = z.object({
  plugin: z.string(),
  marketplace: z.string(),
  version: z.string(),
  skills: z.array(PluginSkillEntrySchema),
});

export type PluginSkillEntry = z.infer<typeof PluginSkillEntrySchema>;
export type PluginSkillGroup = z.infer<typeof PluginSkillGroupSchema>;
```

Add `pluginSkills` to the `ScanResult` interface:

```typescript
export interface ScanResult {
  settings: Record<string, unknown> | null;
  permissions: { allow: string[] } | null;
  plugins: PluginEntry[];
  skills: string[];
  claudeMdFiles: string[];
  pluginSkills: PluginSkillGroup[];
}
```

Add `pluginSkills` to the `ManifestSchema` components:

```typescript
// Inside ManifestSchema.components:
pluginSkills: z.object({ include: z.boolean(), file: z.string() }).optional(),
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/plugin-skills.test.ts`
Expected: PASS (2 tests)

**Step 5: Fix existing tests**

The existing tests create `ScanResult` objects without `pluginSkills`. Add `pluginSkills: []` to all test fixtures in:
- `tests/scanner.test.ts` — the `scanClaudeDir` return will need updating (done in Task 2)
- `tests/manifest.test.ts:7` — add `pluginSkills: []` to both `ScanResult` objects

Run: `bun test`
Expected: All existing tests pass (some scanner tests may fail until Task 2)

**Step 6: Commit**

```bash
git add src/types.ts tests/plugin-skills.test.ts tests/manifest.test.ts
git commit -m "feat: add PluginSkillGroup types and schemas"
```

---

### Task 2: Implement YAML Frontmatter Parser and Plugin Skill Scanner

**Files:**
- Modify: `src/lib/scanner.ts:1-55`
- Test: `tests/plugin-skills.test.ts` (append to existing)
- Test: `tests/scanner.test.ts` (update fixtures)

**Step 1: Write the failing tests**

Append to `tests/plugin-skills.test.ts`:

```typescript
import { parseSkillFrontmatter, scanPluginSkills } from "../src/lib/scanner";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { beforeEach, afterEach } from "bun:test";

const TEST_DIR = join(import.meta.dir, ".test-plugin-skills");

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

describe("scanPluginSkills", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    // Create fake installed_plugins.json
    mkdirSync(join(TEST_DIR, "plugins"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, "plugins", "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: {
          "my-plugin@my-marketplace": [
            {
              scope: "user",
              version: "1.0.0",
              installPath: join(TEST_DIR, "plugins", "cache", "my-marketplace", "my-plugin", "1.0.0"),
              installedAt: "2026-01-01T00:00:00Z",
              lastUpdated: "2026-01-01T00:00:00Z",
              gitCommitSha: "abc123",
            },
          ],
        },
      })
    );
    // Create plugin with skills
    const skillDir = join(TEST_DIR, "plugins", "cache", "my-marketplace", "my-plugin", "1.0.0", "skills", "cool-skill");
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
    // Remove the skills directory
    rmSync(join(TEST_DIR, "plugins", "cache"), { recursive: true, force: true });
    // Rewrite installed_plugins with an installPath that has no skills/
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
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/plugin-skills.test.ts`
Expected: FAIL — `parseSkillFrontmatter` and `scanPluginSkills` don't exist

**Step 3: Write minimal implementation**

Add to `src/lib/scanner.ts`:

```typescript
import type { ScanResult, PluginEntry, PluginSkillGroup, PluginSkillEntry } from "../types";

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
    // Strip surrounding quotes
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
```

Update `scanClaudeDir` to call `scanPluginSkills` and include it in the return:

```typescript
export async function scanClaudeDir(claudeDir: string): Promise<ScanResult> {
  // ... existing code ...
  const pluginSkills = await scanPluginSkills(claudeDir);
  return { settings, permissions, plugins, skills, claudeMdFiles: [], pluginSkills };
}
```

**Step 4: Run all tests to verify they pass**

Run: `bun test`
Expected: All tests pass (existing + new)

**Step 5: Commit**

```bash
git add src/lib/scanner.ts tests/plugin-skills.test.ts tests/scanner.test.ts
git commit -m "feat: add YAML frontmatter parser and plugin skill scanner"
```

---

### Task 3: Update Manifest Generation

**Files:**
- Modify: `src/lib/manifest.ts:10-37`
- Test: `tests/manifest.test.ts` (update existing tests)

**Step 1: Write the failing test**

Add to `tests/manifest.test.ts`:

```typescript
test("includes pluginSkills component when plugin skills found", () => {
  const scan: ScanResult = {
    settings: null,
    permissions: null,
    plugins: [{ name: "superpowers", marketplace: "official", version: "4.3.1" }],
    skills: [],
    claudeMdFiles: [],
    pluginSkills: [
      {
        plugin: "superpowers",
        marketplace: "official",
        version: "4.3.1",
        skills: [{ name: "brainstorming", description: "creative work" }],
      },
    ],
  };
  const manifest = generateManifest(scan, {
    name: "test",
    description: "test",
    author: "tester",
    tags: [],
  });
  expect(manifest.components.pluginSkills?.include).toBe(true);
  expect(manifest.components.pluginSkills?.file).toBe("plugin-skills.json");
});

test("excludes pluginSkills when no plugin skills found", () => {
  const scan: ScanResult = {
    settings: null,
    permissions: null,
    plugins: [],
    skills: [],
    claudeMdFiles: [],
    pluginSkills: [],
  };
  const manifest = generateManifest(scan, {
    name: "test",
    description: "test",
    author: "tester",
    tags: [],
  });
  expect(manifest.components.pluginSkills).toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/manifest.test.ts`
Expected: FAIL — `pluginSkills` is not generated

**Step 3: Write minimal implementation**

In `src/lib/manifest.ts`, add inside `generateManifest` after the skills block:

```typescript
if (scan.pluginSkills.length > 0) {
  components.pluginSkills = { include: true, file: "plugin-skills.json" };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/manifest.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/lib/manifest.ts tests/manifest.test.ts
git commit -m "feat: include pluginSkills component in manifest generation"
```

---

### Task 4: Update Init Command

**Files:**
- Modify: `src/commands/init.ts:26-118`

**Step 1: Add plugin skills display in scan summary**

After the skills display block (line ~41), add:

```typescript
if (scan.pluginSkills.length > 0) {
  const totalSkills = scan.pluginSkills.reduce((sum, g) => sum + g.skills.length, 0);
  console.log(`    ${chalk.green("+")} Plugin Skills (${totalSkills} from ${scan.pluginSkills.length} plugins)`);
  for (const group of scan.pluginSkills) {
    console.log(`      ${chalk.dim(group.plugin)} (${group.skills.length} skills)`);
    for (const skill of group.skills) {
      console.log(`        ${chalk.dim("-")} ${skill.name}`);
    }
  }
}
```

**Step 2: Add plugin-skills.json export**

After the skills copy block (line ~110), add:

```typescript
if (scan.pluginSkills.length > 0) {
  await writeFile(join(outputDir, "plugin-skills.json"), JSON.stringify(scan.pluginSkills, null, 2));
}
```

**Step 3: Run manually to verify**

Run: `bun run src/index.ts init -o /tmp/test-plugin-skills -n "test" -d "test" -a "test" -t "test"`
Expected: Output shows "Plugin Skills" section, `/tmp/test-plugin-skills/plugin-skills.json` is written

**Step 4: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat: export plugin skills metadata during init"
```

---

### Task 5: Add Plugin Skills Renderer

**Files:**
- Modify: `src/lib/renderer.ts:1-55`

**Step 1: Write the implementation**

Add to `src/lib/renderer.ts`:

```typescript
import type { Manifest, PluginEntry, PluginSkillGroup } from "../types";

export function renderPluginSkills(groups: PluginSkillGroup[]): string {
  const lines: string[] = [];
  lines.push(chalk.bold("  Plugin Skills:"));
  for (const group of groups) {
    lines.push(`    ${chalk.cyan(group.plugin)} ${chalk.dim(`(${group.marketplace} v${group.version})`)}`);
    for (const skill of group.skills) {
      lines.push(`      ${chalk.white(skill.name)} ${chalk.dim("—")} ${chalk.dim(skill.description)}`);
    }
  }
  return lines.join("\n");
}
```

Update the import at the top to include `PluginSkillGroup`.

**Step 2: Update renderManifest to show pluginSkills component**

In `renderManifest`, add after the `claudeMd` line:

```typescript
if (c.pluginSkills?.include) lines.push(`    ${chalk.green("+")} Plugin Skills ${chalk.dim(c.pluginSkills.file)}`);
```

**Step 3: Commit**

```bash
git add src/lib/renderer.ts
git commit -m "feat: add renderPluginSkills renderer function"
```

---

### Task 6: Update Show Command

**Files:**
- Modify: `src/commands/show.ts:1-53`

**Step 1: Write the implementation**

In `show.ts`, add after the existing skills block (line ~44):

```typescript
if (manifest.components.pluginSkills?.include) {
  const pluginSkillsJson = await fetchFile(repo, manifest.components.pluginSkills.file);
  const pluginSkills: PluginSkillGroup[] = JSON.parse(pluginSkillsJson);
  console.log(renderPluginSkills(pluginSkills));
  console.log("");
}
```

Update imports:

```typescript
import { renderManifest, renderPluginList, renderPluginSkills } from "../lib/renderer";
import type { PluginEntry, PluginSkillGroup } from "../types";
```

**Step 2: Run manually against a repo that has plugin-skills.json**

First, update your own exported setup:
Run: `bun run src/index.ts init -o /tmp/test-show -n "test" -d "test" -a "test" -t "test"`
Verify: `cat /tmp/test-show/plugin-skills.json` shows plugin skills

**Step 3: Commit**

```bash
git add src/commands/show.ts
git commit -m "feat: display plugin skills in show command"
```

---

### Task 7: Update README Generation

**Files:**
- Modify: `src/commands/init.ts` — `generateReadme` function (line ~121-182)

**Step 1: Write the implementation**

Add after the "Custom Skills" section in `generateReadme`:

```typescript
if (scan.pluginSkills.length > 0) {
  lines.push("### Plugin Skills");
  lines.push("");
  for (const group of scan.pluginSkills) {
    lines.push(`#### ${group.plugin} (${group.marketplace} v${group.version})`);
    lines.push("");
    for (const skill of group.skills) {
      lines.push(`- **${skill.name}** — ${skill.description}`);
    }
    lines.push("");
  }
}
```

**Step 2: Run manually to verify**

Run: `bun run src/index.ts init -o /tmp/test-readme -n "test" -d "test" -a "test" -t "test"`
Verify: `cat /tmp/test-readme/README.md` includes "Plugin Skills" section

**Step 3: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat: include plugin skills in generated README"
```

---

### Task 8: Run Full Test Suite and Final Verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass (existing 19 + new plugin-skills tests)

**Step 2: End-to-end test with real config**

Run: `bun run src/index.ts init -o /tmp/final-test -n "final test" -d "testing plugin skills" -a "tester" -t "test"`

Verify:
- `/tmp/final-test/plugin-skills.json` exists and contains superpowers skills
- `/tmp/final-test/claude-dotfiles.json` has `pluginSkills` component
- `/tmp/final-test/README.md` has "Plugin Skills" section
- Console output shows plugin skills summary

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat: complete plugin skills sharing feature"
```

**Step 4: Push to GitHub**

```bash
git push
```
