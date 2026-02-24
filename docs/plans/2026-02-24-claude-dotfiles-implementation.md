# claude-dotfiles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that lets people share, discover, and install each other's Claude Code configurations via GitHub repos.

**Architecture:** Manifest-based approach — each setup is a GitHub repo with a `claude-dotfiles.json` manifest. The CLI scans `~/.claude/`, exports configs, and installs others' configs via merge strategies. No server needed.

**Tech Stack:** TypeScript + Bun, commander, chalk, @inquirer/prompts, zod

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `src/types.ts`

**Step 1: Initialize bun project**

Run: `cd /Users/jongsu/claude-dotfiles && bun init -y`
Expected: Creates `package.json`, `tsconfig.json`, etc.

**Step 2: Install dependencies**

Run: `cd /Users/jongsu/claude-dotfiles && bun add commander chalk zod && bun add -d @types/node`
Expected: Packages installed, `bun.lock` created.

**Step 3: Create types file**

Write `src/types.ts`:

```typescript
import { z } from "zod";

export const ComponentRefSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("file"), include: z.boolean(), file: z.string() }),
  z.object({ type: z.literal("dir"), include: z.boolean(), dir: z.string() }),
]);

export const ManifestSchema = z.object({
  name: z.string(),
  description: z.string(),
  author: z.string(),
  version: z.string().default("1.0.0"),
  components: z.object({
    plugins: z.object({ include: z.boolean(), file: z.string() }).optional(),
    settings: z.object({ include: z.boolean(), file: z.string() }).optional(),
    permissions: z.object({ include: z.boolean(), file: z.string() }).optional(),
    skills: z.object({ include: z.boolean(), dir: z.string() }).optional(),
    claudeMd: z.object({ include: z.boolean(), dir: z.string() }).optional(),
  }),
  tags: z.array(z.string()).default([]),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export interface PluginEntry {
  name: string;
  marketplace: string;
  version: string;
}

export interface ScanResult {
  settings: Record<string, unknown> | null;
  permissions: { allow: string[] } | null;
  plugins: PluginEntry[];
  skills: string[]; // directory names
  claudeMdFiles: string[]; // file paths found
}
```

**Step 4: Create CLI entry point**

Write `src/index.ts`:

```typescript
#!/usr/bin/env bun
import { Command } from "commander";

const program = new Command();

program
  .name("claude-dotfiles")
  .description("Share, discover, and install Claude Code configurations")
  .version("0.1.0");

// Commands will be registered here as we build them

program.parse();
```

**Step 5: Add bin entry to package.json**

In `package.json`, ensure `"bin"` field is set:
```json
{
  "bin": {
    "claude-dotfiles": "src/index.ts"
  }
}
```

**Step 6: Verify CLI runs**

Run: `cd /Users/jongsu/claude-dotfiles && bun run src/index.ts --help`
Expected: Shows help output with name/description/version.

**Step 7: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add -A && git commit -m "feat: scaffold project with types and CLI entry point"
```

---

### Task 2: Scanner — Read ~/.claude/ Config

**Files:**
- Create: `src/lib/scanner.ts`
- Create: `tests/scanner.test.ts`

**Step 1: Write the failing test**

Write `tests/scanner.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/scanner.test.ts`
Expected: FAIL — `scanClaudeDir` not found.

**Step 3: Write the scanner implementation**

Write `src/lib/scanner.ts`:

```typescript
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

  // Extract permissions
  const permissions = localRaw?.permissions
    ? (localRaw.permissions as { allow: string[] })
    : null;

  // Extract settings (without permissions — those come from settings.local.json)
  const settings = settingsRaw;

  // Parse plugins
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

  // Find custom skills
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
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/scanner.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/lib/scanner.ts tests/scanner.test.ts && git commit -m "feat: add scanner to read ~/.claude/ config"
```

---

### Task 3: Sanitizer — Strip Sensitive Data

**Files:**
- Create: `src/lib/sanitizer.ts`
- Create: `tests/sanitizer.test.ts`

**Step 1: Write the failing test**

Write `tests/sanitizer.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { sanitizeSettings, findSensitiveStrings } from "../src/lib/sanitizer";

describe("sanitizeSettings", () => {
  test("strips fields with sensitive keywords", () => {
    const input = {
      apiKey: "sk-12345",
      statusLine: { type: "command", command: "echo hi" },
      secretToken: "tok-abc",
      enabledPlugins: { "foo@bar": true },
    };
    const result = sanitizeSettings(input);
    expect(result.apiKey).toBeUndefined();
    expect(result.secretToken).toBeUndefined();
    expect(result.statusLine).toBeDefined();
    expect(result.enabledPlugins).toBeDefined();
  });

  test("strips nested sensitive fields", () => {
    const input = {
      nested: { deep: { password: "hunter2", name: "ok" } },
    };
    const result = sanitizeSettings(input);
    expect(result.nested.deep.password).toBeUndefined();
    expect(result.nested.deep.name).toBe("ok");
  });
});

describe("findSensitiveStrings", () => {
  test("detects home directory paths", () => {
    const input = {
      command: "/Users/jongsu/.bun/bin/bun",
      name: "safe",
    };
    const warnings = findSensitiveStrings(input, "/Users/jongsu");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("/Users/jongsu");
  });

  test("returns empty for clean data", () => {
    const input = { name: "safe", value: 42 };
    const warnings = findSensitiveStrings(input, "/Users/jongsu");
    expect(warnings).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/sanitizer.test.ts`
Expected: FAIL — modules not found.

**Step 3: Write the sanitizer implementation**

Write `src/lib/sanitizer.ts`:

```typescript
const SENSITIVE_KEYS = /key|token|secret|password|credential/i;

export function sanitizeSettings(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeSettings(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function findSensitiveStrings(
  obj: unknown,
  homeDir: string,
  path: string = ""
): string[] {
  const warnings: string[] = [];
  if (typeof obj === "string") {
    if (obj.includes(homeDir)) {
      warnings.push(`${path}: contains home directory path "${homeDir}"`);
    }
  } else if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      warnings.push(...findSensitiveStrings(value, homeDir, childPath));
    }
  }
  return warnings;
}

export function anonymizePaths(
  obj: Record<string, unknown>,
  homeDir: string
): Record<string, unknown> {
  const json = JSON.stringify(obj);
  const anonymized = json.replaceAll(homeDir, "~");
  return JSON.parse(anonymized);
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/sanitizer.test.ts`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/lib/sanitizer.ts tests/sanitizer.test.ts && git commit -m "feat: add sanitizer to strip sensitive data from configs"
```

---

### Task 4: Manifest — Generate and Validate

**Files:**
- Create: `src/lib/manifest.ts`
- Create: `tests/manifest.test.ts`

**Step 1: Write the failing test**

Write `tests/manifest.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { generateManifest, validateManifest } from "../src/lib/manifest";
import type { ScanResult } from "../src/types";

describe("generateManifest", () => {
  test("generates manifest from scan result", () => {
    const scan: ScanResult = {
      settings: { enabledPlugins: {} },
      permissions: { allow: ["Bash(ls:*)"] },
      plugins: [{ name: "superpowers", marketplace: "official", version: "4.3.1" }],
      skills: ["my-skill"],
      claudeMdFiles: [],
    };
    const manifest = generateManifest(scan, {
      name: "test setup",
      description: "a test",
      author: "tester",
      tags: ["test"],
    });
    expect(manifest.name).toBe("test setup");
    expect(manifest.components.plugins?.include).toBe(true);
    expect(manifest.components.settings?.include).toBe(true);
    expect(manifest.components.permissions?.include).toBe(true);
    expect(manifest.components.skills?.include).toBe(true);
  });

  test("excludes empty components", () => {
    const scan: ScanResult = {
      settings: null,
      permissions: null,
      plugins: [],
      skills: [],
      claudeMdFiles: [],
    };
    const manifest = generateManifest(scan, {
      name: "empty",
      description: "nothing",
      author: "tester",
      tags: [],
    });
    expect(manifest.components.plugins).toBeUndefined();
    expect(manifest.components.settings).toBeUndefined();
    expect(manifest.components.skills).toBeUndefined();
  });
});

describe("validateManifest", () => {
  test("accepts valid manifest", () => {
    const valid = {
      name: "test",
      description: "desc",
      author: "me",
      version: "1.0.0",
      components: {
        plugins: { include: true, file: "plugins.json" },
      },
      tags: ["test"],
    };
    const result = validateManifest(valid);
    expect(result.success).toBe(true);
  });

  test("rejects manifest missing required fields", () => {
    const invalid = { name: "test" };
    const result = validateManifest(invalid);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/manifest.test.ts`
Expected: FAIL — modules not found.

**Step 3: Write the manifest implementation**

Write `src/lib/manifest.ts`:

```typescript
import { ManifestSchema, type Manifest, type ScanResult } from "../types";

interface ManifestMeta {
  name: string;
  description: string;
  author: string;
  tags: string[];
}

export function generateManifest(scan: ScanResult, meta: ManifestMeta): Manifest {
  const components: Manifest["components"] = {};

  if (scan.plugins.length > 0) {
    components.plugins = { include: true, file: "plugins.json" };
  }
  if (scan.settings) {
    components.settings = { include: true, file: "settings.json" };
  }
  if (scan.permissions) {
    components.permissions = { include: true, file: "permissions.json" };
  }
  if (scan.skills.length > 0) {
    components.skills = { include: true, dir: "skills/" };
  }
  if (scan.claudeMdFiles.length > 0) {
    components.claudeMd = { include: true, dir: "claude-md/" };
  }

  return {
    name: meta.name,
    description: meta.description,
    author: meta.author,
    version: "1.0.0",
    components,
    tags: meta.tags,
  };
}

export function validateManifest(data: unknown): { success: boolean; data?: Manifest; error?: string } {
  const result = ManifestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/manifest.test.ts`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/lib/manifest.ts tests/manifest.test.ts && git commit -m "feat: add manifest generation and validation"
```

---

### Task 5: Renderer — Pretty Terminal Output

**Files:**
- Create: `src/lib/renderer.ts`

**Step 1: Write the renderer**

Write `src/lib/renderer.ts`:

```typescript
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
```

**Step 2: Verify it compiles**

Run: `cd /Users/jongsu/claude-dotfiles && bun build src/lib/renderer.ts --no-bundle 2>&1 | head -5`
Expected: No type errors.

**Step 3: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/lib/renderer.ts && git commit -m "feat: add terminal renderer for pretty output"
```

---

### Task 6: Backup & Restore

**Files:**
- Create: `src/lib/backup.ts`
- Create: `tests/backup.test.ts`

**Step 1: Write the failing test**

Write `tests/backup.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createBackup, restoreBackup, listBackups } from "../src/lib/backup";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, ".test-claude-backup");
const BACKUP_DIR = join(TEST_DIR, "backups");

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
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/backup.test.ts`
Expected: FAIL — modules not found.

**Step 3: Write the backup implementation**

Write `src/lib/backup.ts`:

```typescript
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

  // Backup plugins list
  try {
    await mkdir(join(backupPath, "plugins"), { recursive: true });
    await cp(
      join(claudeDir, "plugins", "installed_plugins.json"),
      join(backupPath, "plugins", "installed_plugins.json")
    );
  } catch {
    // may not exist
  }

  // Backup skills
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
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/backup.test.ts`
Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/lib/backup.ts tests/backup.test.ts && git commit -m "feat: add backup and restore for ~/.claude/ configs"
```

---

### Task 7: Merger — Merge Strategies for Each Component

**Files:**
- Create: `src/lib/merger.ts`
- Create: `tests/merger.test.ts`

**Step 1: Write the failing test**

Write `tests/merger.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { mergeSettings, mergePermissions } from "../src/lib/merger";

describe("mergeSettings", () => {
  test("deep merges without overwriting existing keys", () => {
    const existing = { statusLine: { type: "command" }, model: "opus" };
    const incoming = { statusLine: { type: "text" }, theme: "dark" };
    const { merged, conflicts } = mergeSettings(existing, incoming);
    expect(merged.statusLine.type).toBe("command"); // existing preserved
    expect(merged.theme).toBe("dark"); // new key added
    expect(conflicts).toHaveLength(1); // statusLine.type conflict
  });

  test("adds new top-level keys", () => {
    const existing = { a: 1 };
    const incoming = { b: 2 };
    const { merged, conflicts } = mergeSettings(existing, incoming);
    expect(merged.a).toBe(1);
    expect(merged.b).toBe(2);
    expect(conflicts).toHaveLength(0);
  });
});

describe("mergePermissions", () => {
  test("unions allow rules without duplicates", () => {
    const existing = { allow: ["Bash(ls:*)", "Bash(git:*)"] };
    const incoming = { allow: ["Bash(ls:*)", "Bash(npm:*)"] };
    const result = mergePermissions(existing, incoming);
    expect(result.allow).toContain("Bash(ls:*)");
    expect(result.allow).toContain("Bash(git:*)");
    expect(result.allow).toContain("Bash(npm:*)");
    expect(result.allow).toHaveLength(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/merger.test.ts`
Expected: FAIL — modules not found.

**Step 3: Write the merger implementation**

Write `src/lib/merger.ts`:

```typescript
interface MergeResult {
  merged: Record<string, any>;
  conflicts: string[];
}

export function mergeSettings(
  existing: Record<string, any>,
  incoming: Record<string, any>,
  path: string = ""
): MergeResult {
  const merged: Record<string, any> = { ...existing };
  const conflicts: string[] = [];

  for (const [key, incomingValue] of Object.entries(incoming)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (!(key in existing)) {
      merged[key] = incomingValue;
    } else if (
      typeof existing[key] === "object" &&
      !Array.isArray(existing[key]) &&
      typeof incomingValue === "object" &&
      !Array.isArray(incomingValue)
    ) {
      const nested = mergeSettings(existing[key], incomingValue, currentPath);
      merged[key] = nested.merged;
      conflicts.push(...nested.conflicts);
    } else if (JSON.stringify(existing[key]) !== JSON.stringify(incomingValue)) {
      conflicts.push(currentPath);
      // Keep existing value
    }
  }

  return { merged, conflicts };
}

export function mergePermissions(
  existing: { allow: string[] },
  incoming: { allow: string[] }
): { allow: string[] } {
  const combined = new Set([...existing.allow, ...incoming.allow]);
  return { allow: [...combined] };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/jongsu/claude-dotfiles && bun test tests/merger.test.ts`
Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/lib/merger.ts tests/merger.test.ts && git commit -m "feat: add merge strategies for settings and permissions"
```

---

### Task 8: GitHub Integration

**Files:**
- Create: `src/lib/github.ts`

**Step 1: Write the GitHub integration**

Write `src/lib/github.ts`:

```typescript
import { $ } from "bun";

export interface SearchResult {
  fullName: string;
  description: string;
  url: string;
}

export async function searchRepos(query?: string): Promise<SearchResult[]> {
  const searchQuery = query
    ? `${query} topic:claude-dotfiles`
    : "topic:claude-dotfiles";

  const result = await $`gh search repos ${searchQuery} --json fullName,description,url --limit 20`.text();
  return JSON.parse(result);
}

export async function fetchManifest(repo: string): Promise<unknown> {
  const result = await $`gh api repos/${repo}/contents/claude-dotfiles.json --jq .content`.text();
  const decoded = Buffer.from(result.trim(), "base64").toString("utf-8");
  return JSON.parse(decoded);
}

export async function fetchFile(repo: string, path: string): Promise<string> {
  const result = await $`gh api repos/${repo}/contents/${path} --jq .content`.text();
  return Buffer.from(result.trim(), "base64").toString("utf-8");
}

export async function cloneRepo(repo: string, dest: string): Promise<void> {
  await $`gh repo clone ${repo} ${dest} -- --depth 1`;
}

export async function createRepo(name: string, description: string): Promise<string> {
  const result = await $`gh repo create ${name} --public --description ${description} --clone=false`.text();
  return result.trim();
}

export async function addTopic(repo: string): Promise<void> {
  // Get current topics, add claude-dotfiles
  const current = await $`gh api repos/${repo} --jq .topics`.text();
  const topics: string[] = JSON.parse(current);
  if (!topics.includes("claude-dotfiles")) {
    topics.push("claude-dotfiles");
    await $`gh api repos/${repo} -X PATCH -f names=${JSON.stringify(topics)}`.quiet();
  }
}

export async function pushToGithub(dir: string, repo: string): Promise<void> {
  await $`git -C ${dir} remote add origin https://github.com/${repo}.git`.quiet().nothrow();
  await $`git -C ${dir} push -u origin main`;
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/jongsu/claude-dotfiles && bun build src/lib/github.ts --no-bundle 2>&1 | head -5`
Expected: No type errors.

**Step 3: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/lib/github.ts && git commit -m "feat: add GitHub integration via gh CLI"
```

---

### Task 9: `init` Command

**Files:**
- Create: `src/commands/init.ts`
- Modify: `src/index.ts` — register init command

**Step 1: Write the init command**

Write `src/commands/init.ts`:

```typescript
import { Command } from "commander";
import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";
import { writeFile, mkdir, cp } from "fs/promises";
import { scanClaudeDir } from "../lib/scanner";
import { sanitizeSettings, findSensitiveStrings, anonymizePaths } from "../lib/sanitizer";
import { generateManifest } from "../lib/manifest";
import { renderManifest } from "../lib/renderer";

export const initCommand = new Command("init")
  .description("Export your current Claude Code setup")
  .option("-o, --output <dir>", "Output directory", ".")
  .option("--claude-dir <dir>", "Claude config directory", join(homedir(), ".claude"))
  .action(async (opts) => {
    const claudeDir = opts.claudeDir;
    const outputDir = opts.output;

    console.log(chalk.bold("\nScanning Claude Code configuration...\n"));

    const scan = await scanClaudeDir(claudeDir);

    // Summarize what was found
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

    // Check for sensitive data
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

    // Prompt for metadata
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

    // Generate manifest
    const manifest = generateManifest(scan, { name, description, author, tags });

    // Write files
    await mkdir(outputDir, { recursive: true });

    // Manifest
    await writeFile(
      join(outputDir, "claude-dotfiles.json"),
      JSON.stringify(manifest, null, 2)
    );

    // Settings (sanitized + anonymized)
    if (scan.settings) {
      let sanitized = sanitizeSettings(scan.settings);
      sanitized = anonymizePaths(sanitized, homedir());
      await writeFile(join(outputDir, "settings.json"), JSON.stringify(sanitized, null, 2));
    }

    // Permissions
    if (scan.permissions) {
      await writeFile(join(outputDir, "permissions.json"), JSON.stringify(scan.permissions, null, 2));
    }

    // Plugins
    if (scan.plugins.length > 0) {
      await writeFile(join(outputDir, "plugins.json"), JSON.stringify(scan.plugins, null, 2));
    }

    // Skills
    if (scan.skills.length > 0) {
      const skillsSrc = join(claudeDir, "skills");
      const skillsDest = join(outputDir, "skills");
      await mkdir(skillsDest, { recursive: true });
      for (const skill of scan.skills) {
        await cp(join(skillsSrc, skill), join(skillsDest, skill), { recursive: true });
      }
    }

    // Generate README
    const readme = generateReadme(manifest, scan);
    await writeFile(join(outputDir, "README.md"), readme);

    console.log(chalk.bold.green("\n  Setup exported successfully!\n"));
    console.log(renderManifest(manifest));
    console.log(chalk.dim(`\n  Files written to: ${outputDir}`));
    console.log(chalk.dim("  Run `claude-dotfiles publish` to push to GitHub.\n"));
  });

function generateReadme(manifest: ReturnType<typeof generateManifest>, scan: ReturnType<Awaited<typeof scanClaudeDir>> extends Promise<infer T> ? T : never): string {
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
```

**Step 2: Register the command in index.ts**

Add to `src/index.ts` after the version line:

```typescript
import { initCommand } from "./commands/init";
program.addCommand(initCommand);
```

**Step 3: Verify it runs**

Run: `cd /Users/jongsu/claude-dotfiles && bun run src/index.ts init --help`
Expected: Shows init command help with options.

**Step 4: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/commands/init.ts src/index.ts && git commit -m "feat: add init command to export Claude Code setup"
```

---

### Task 10: `show` Command

**Files:**
- Create: `src/commands/show.ts`
- Modify: `src/index.ts` — register show command

**Step 1: Write the show command**

Write `src/commands/show.ts`:

```typescript
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

    // Show plugins comparison
    if (manifest.components.plugins?.include) {
      const pluginsJson = await fetchFile(repo, manifest.components.plugins.file);
      const remotePlugins: PluginEntry[] = JSON.parse(pluginsJson);

      const local = await scanClaudeDir(opts.claudeDir);
      const localNames = local.plugins.map((p) => `${p.name}@${p.marketplace}`);

      console.log(renderPluginList(remotePlugins, localNames));
      console.log("");
    }

    // Show skills
    if (manifest.components.skills?.include) {
      console.log(chalk.bold("  Skills:"));
      console.log(chalk.dim(`    (in ${manifest.components.skills.dir})`));
      console.log("");
    }

    // Show CLAUDE.md
    if (manifest.components.claudeMd?.include) {
      console.log(chalk.bold("  CLAUDE.md templates:"));
      console.log(chalk.dim(`    (in ${manifest.components.claudeMd.dir})`));
      console.log("");
    }

    console.log(chalk.dim(`  To install: claude-dotfiles install ${repo}\n`));
  });
```

**Step 2: Register in index.ts**

Add to `src/index.ts`:

```typescript
import { showCommand } from "./commands/show";
program.addCommand(showCommand);
```

**Step 3: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/commands/show.ts src/index.ts && git commit -m "feat: add show command to preview remote setups"
```

---

### Task 11: `search` Command

**Files:**
- Create: `src/commands/search.ts`
- Modify: `src/index.ts` — register search command

**Step 1: Write the search command**

Write `src/commands/search.ts`:

```typescript
import { Command } from "commander";
import chalk from "chalk";
import { searchRepos } from "../lib/github";
import { renderSearchResult } from "../lib/renderer";

export const searchCommand = new Command("search")
  .description("Search for Claude Code setups on GitHub")
  .argument("[query]", "Search query")
  .action(async (query?: string) => {
    console.log(chalk.dim("\n  Searching GitHub for Claude Code setups...\n"));

    const results = await searchRepos(query);

    if (results.length === 0) {
      console.log(chalk.yellow("  No setups found."));
      if (!query) {
        console.log(chalk.dim("  Be the first! Run `claude-dotfiles init` to share your setup.\n"));
      }
      return;
    }

    console.log(chalk.bold(`  Found ${results.length} setup(s):\n`));

    for (const result of results) {
      // Try to parse author from fullName
      const author = result.fullName.split("/")[0] ?? "unknown";
      console.log(
        renderSearchResult({
          author,
          name: result.fullName,
          description: result.description ?? "No description",
          tags: [],
          url: result.url,
        })
      );
      console.log("");
    }
  });
```

**Step 2: Register in index.ts**

Add to `src/index.ts`:

```typescript
import { searchCommand } from "./commands/search";
program.addCommand(searchCommand);
```

**Step 3: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/commands/search.ts src/index.ts && git commit -m "feat: add search command to discover setups on GitHub"
```

---

### Task 12: `install` Command

**Files:**
- Create: `src/commands/install.ts`
- Modify: `src/index.ts` — register install command

**Step 1: Write the install command**

Write `src/commands/install.ts`:

```typescript
import { Command } from "commander";
import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir, cp } from "fs/promises";
import { cloneRepo, fetchManifest } from "../lib/github";
import { validateManifest } from "../lib/manifest";
import { renderManifest } from "../lib/renderer";
import { createBackup } from "../lib/backup";
import { mergeSettings, mergePermissions } from "../lib/merger";
import { scanClaudeDir } from "../lib/scanner";
import type { Manifest, PluginEntry } from "../types";
import { tmpdir } from "os";

export const installCommand = new Command("install")
  .description("Install a Claude Code setup from GitHub")
  .argument("<repo>", "GitHub repo (user/repo)")
  .option("--claude-dir <dir>", "Claude config directory", join(homedir(), ".claude"))
  .option("--dry-run", "Show what would change without applying", false)
  .action(async (repo: string, opts) => {
    const claudeDir = opts.claudeDir;

    console.log(chalk.dim(`\n  Fetching setup from ${repo}...\n`));

    // Fetch and validate manifest
    const raw = await fetchManifest(repo);
    const validation = validateManifest(raw);
    if (!validation.success) {
      console.error(chalk.red(`  Invalid manifest: ${validation.error}`));
      process.exit(1);
    }
    const manifest = validation.data!;
    console.log(renderManifest(manifest));
    console.log("");

    // Clone to temp dir
    const tempDir = join(tmpdir(), `claude-dotfiles-${Date.now()}`);
    await cloneRepo(repo, tempDir);

    // Interactive component selection
    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((res) => rl.question(q, res));

    const components: string[] = [];
    const c = manifest.components;

    if (c.plugins?.include) {
      const ans = await ask(chalk.bold("  Install plugins? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("plugins");
    }
    if (c.settings?.include) {
      const ans = await ask(chalk.bold("  Merge settings? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("settings");
    }
    if (c.permissions?.include) {
      const ans = await ask(chalk.bold("  Merge permissions? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("permissions");
    }
    if (c.skills?.include) {
      const ans = await ask(chalk.bold("  Install skills? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("skills");
    }
    if (c.claudeMd?.include) {
      const ans = await ask(chalk.bold("  Install CLAUDE.md templates? (y/n): "));
      if (ans.toLowerCase() === "y") components.push("claudeMd");
    }
    rl.close();

    if (components.length === 0) {
      console.log(chalk.yellow("\n  No components selected. Nothing to install.\n"));
      return;
    }

    if (opts.dryRun) {
      console.log(chalk.yellow("\n  Dry run — would install:"));
      for (const comp of components) {
        console.log(`    ${chalk.green("+")} ${comp}`);
      }
      console.log("");
      return;
    }

    // Create backup
    console.log(chalk.dim("\n  Creating backup..."));
    const backupPath = await createBackup(claudeDir);
    console.log(chalk.dim(`  Backup saved to: ${backupPath}\n`));

    // Install selected components
    if (components.includes("settings") && c.settings) {
      console.log(chalk.bold("  Merging settings..."));
      const remoteSettings = JSON.parse(
        await readFile(join(tempDir, c.settings.file), "utf-8")
      );
      const localSettingsPath = join(claudeDir, "settings.json");
      let localSettings: Record<string, any> = {};
      try {
        localSettings = JSON.parse(await readFile(localSettingsPath, "utf-8"));
      } catch {
        // no existing settings
      }
      const { merged, conflicts } = mergeSettings(localSettings, remoteSettings);
      await writeFile(localSettingsPath, JSON.stringify(merged, null, 2));
      if (conflicts.length > 0) {
        console.log(chalk.yellow(`    ${conflicts.length} conflict(s) — existing values kept:`));
        for (const c of conflicts) {
          console.log(`      ${chalk.dim(c)}`);
        }
      }
      console.log(chalk.green("    Done."));
    }

    if (components.includes("permissions") && c.permissions) {
      console.log(chalk.bold("  Merging permissions..."));
      const remotePerms = JSON.parse(
        await readFile(join(tempDir, c.permissions.file), "utf-8")
      );
      const localPermsPath = join(claudeDir, "settings.local.json");
      let localPermsFile: Record<string, any> = {};
      try {
        localPermsFile = JSON.parse(await readFile(localPermsPath, "utf-8"));
      } catch {
        // no existing
      }
      const localPerms = localPermsFile.permissions ?? { allow: [] };
      const merged = mergePermissions(localPerms, remotePerms);
      localPermsFile.permissions = merged;
      await writeFile(localPermsPath, JSON.stringify(localPermsFile, null, 2));
      const newCount = merged.allow.length - (localPerms.allow?.length ?? 0);
      console.log(chalk.green(`    Done. Added ${newCount} new permission rule(s).`));
    }

    if (components.includes("plugins") && c.plugins) {
      console.log(chalk.bold("  Installing plugins..."));
      const remotePlugins: PluginEntry[] = JSON.parse(
        await readFile(join(tempDir, c.plugins.file), "utf-8")
      );
      const local = await scanClaudeDir(claudeDir);
      const localNames = local.plugins.map((p) => `${p.name}@${p.marketplace}`);
      const newPlugins = remotePlugins.filter(
        (p) => !localNames.includes(`${p.name}@${p.marketplace}`)
      );
      if (newPlugins.length === 0) {
        console.log(chalk.dim("    All plugins already installed."));
      } else {
        for (const p of newPlugins) {
          console.log(`    Installing ${p.name}@${p.marketplace}...`);
          // Note: actual plugin install would need `claude plugin install` CLI
          // For now, log what would be installed
          console.log(chalk.yellow(`    TODO: Run 'claude plugin install ${p.name}@${p.marketplace}'`));
        }
      }
    }

    if (components.includes("skills") && c.skills) {
      console.log(chalk.bold("  Installing skills..."));
      const skillsSrc = join(tempDir, c.skills.dir);
      const skillsDest = join(claudeDir, "skills");
      await mkdir(skillsDest, { recursive: true });
      await cp(skillsSrc, skillsDest, { recursive: true });
      console.log(chalk.green("    Done."));
    }

    if (components.includes("claudeMd") && c.claudeMd) {
      console.log(chalk.bold("  Installing CLAUDE.md templates..."));
      const mdSrc = join(tempDir, c.claudeMd.dir);
      const mdDest = join(claudeDir, "claude-md-imports");
      await mkdir(mdDest, { recursive: true });
      await cp(mdSrc, mdDest, { recursive: true });
      console.log(chalk.green(`    Done. Templates saved to ${mdDest}`));
    }

    console.log(chalk.bold.green("\n  Installation complete!"));
    console.log(chalk.dim(`  Run 'claude-dotfiles rollback' to undo.\n`));
  });
```

**Step 2: Register in index.ts**

Add to `src/index.ts`:

```typescript
import { installCommand } from "./commands/install";
program.addCommand(installCommand);
```

**Step 3: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/commands/install.ts src/index.ts && git commit -m "feat: add install command with merge strategies and backup"
```

---

### Task 13: `publish` Command

**Files:**
- Create: `src/commands/publish.ts`
- Modify: `src/index.ts` — register publish command

**Step 1: Write the publish command**

Write `src/commands/publish.ts`:

```typescript
import { Command } from "commander";
import chalk from "chalk";
import { access } from "fs/promises";
import { join } from "path";
import { $ } from "bun";
import { createRepo, addTopic, pushToGithub } from "../lib/github";

export const publishCommand = new Command("publish")
  .description("Publish your Claude Code setup to GitHub")
  .option("-d, --dir <dir>", "Directory containing exported setup", ".")
  .action(async (opts) => {
    const dir = opts.dir;

    // Verify manifest exists
    const manifestPath = join(dir, "claude-dotfiles.json");
    try {
      await access(manifestPath);
    } catch {
      console.error(chalk.red("\n  No claude-dotfiles.json found."));
      console.error(chalk.dim("  Run `claude-dotfiles init` first.\n"));
      process.exit(1);
    }

    const manifest = JSON.parse(await Bun.file(manifestPath).text());

    console.log(chalk.bold(`\n  Publishing "${manifest.name}"...\n`));

    // Check if git repo exists
    const isGitRepo = await $`git -C ${dir} rev-parse --git-dir`.quiet().nothrow();
    if (isGitRepo.exitCode !== 0) {
      console.log(chalk.dim("  Initializing git repo..."));
      await $`git -C ${dir} init`;
      await $`git -C ${dir} add -A`;
      await $`git -C ${dir} commit -m "Initial claude-dotfiles export"`;
    }

    // Prompt for repo name
    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((res) => rl.question(q, res));

    const repoName = await ask(chalk.bold("  GitHub repo name (e.g. my-claude-dotfiles): "));
    rl.close();

    // Create repo on GitHub
    console.log(chalk.dim(`  Creating GitHub repo: ${repoName}...`));
    const repoUrl = await createRepo(repoName, manifest.description);
    console.log(chalk.dim(`  Created: ${repoUrl}`));

    // Get the user/repo format
    const ghUser = (await $`gh api user --jq .login`.text()).trim();
    const fullRepo = `${ghUser}/${repoName}`;

    // Push
    console.log(chalk.dim("  Pushing to GitHub..."));
    await pushToGithub(dir, fullRepo);

    // Add topic
    console.log(chalk.dim("  Adding claude-dotfiles topic..."));
    await addTopic(fullRepo);

    console.log(chalk.bold.green(`\n  Published successfully!`));
    console.log(`  ${chalk.underline.blue(`https://github.com/${fullRepo}`)}`);
    console.log(chalk.dim(`\n  Others can install with: claude-dotfiles install ${fullRepo}\n`));
  });
```

**Step 2: Register in index.ts**

Add to `src/index.ts`:

```typescript
import { publishCommand } from "./commands/publish";
program.addCommand(publishCommand);
```

**Step 3: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/commands/publish.ts src/index.ts && git commit -m "feat: add publish command to push setup to GitHub"
```

---

### Task 14: `rollback` Command

**Files:**
- Create: `src/commands/rollback.ts`
- Modify: `src/index.ts` — register rollback command

**Step 1: Write the rollback command**

Write `src/commands/rollback.ts`:

```typescript
import { Command } from "commander";
import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";
import { listBackups, restoreBackup } from "../lib/backup";

export const rollbackCommand = new Command("rollback")
  .description("Restore Claude Code config from a backup")
  .option("--claude-dir <dir>", "Claude config directory", join(homedir(), ".claude"))
  .action(async (opts) => {
    const claudeDir = opts.claudeDir;
    const backups = await listBackups(claudeDir);

    if (backups.length === 0) {
      console.log(chalk.yellow("\n  No backups found.\n"));
      return;
    }

    console.log(chalk.bold(`\n  Available backups (${backups.length}):\n`));
    for (let i = 0; i < backups.length; i++) {
      const name = backups[i].split("/").pop()!;
      const timestamp = name.replace("claude-dotfiles-", "").replace(/-/g, (m, offset) => {
        // Restore ISO format for display
        if (offset === 10) return "T";
        if (offset === 13 || offset === 16) return ":";
        return m;
      });
      console.log(`    ${chalk.bold(`[${i + 1}]`)} ${timestamp}`);
    }

    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((res) => rl.question(q, res));

    const choice = await ask(chalk.bold(`\n  Restore which backup? [1-${backups.length}]: `));
    rl.close();

    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= backups.length) {
      console.log(chalk.red("  Invalid choice.\n"));
      return;
    }

    console.log(chalk.dim("\n  Restoring..."));
    await restoreBackup(backups[idx], claudeDir);
    console.log(chalk.bold.green("  Restored successfully!\n"));
  });
```

**Step 2: Register in index.ts**

Add to `src/index.ts`:

```typescript
import { rollbackCommand } from "./commands/rollback";
program.addCommand(rollbackCommand);
```

**Step 3: Commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add src/commands/rollback.ts src/index.ts && git commit -m "feat: add rollback command to restore from backup"
```

---

### Task 15: Run All Tests & Final Integration

**Files:**
- Modify: `package.json` — add scripts

**Step 1: Add scripts to package.json**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "test": "bun test",
    "build": "bun build src/index.ts --compile --outfile claude-dotfiles",
    "link": "bun link"
  }
}
```

**Step 2: Run all tests**

Run: `cd /Users/jongsu/claude-dotfiles && bun test`
Expected: All tests pass (scanner: 5, sanitizer: 4, manifest: 4, backup: 3, merger: 3 = 19 total).

**Step 3: Test the full init flow manually**

Run: `cd /tmp && mkdir test-dotfiles && cd test-dotfiles && bun run /Users/jongsu/claude-dotfiles/src/index.ts init --output /tmp/test-dotfiles`
Expected: Prompts for name/description/author/tags, exports config files.

**Step 4: Test the build**

Run: `cd /Users/jongsu/claude-dotfiles && bun build src/index.ts --compile --outfile claude-dotfiles`
Expected: Produces `claude-dotfiles` binary.

**Step 5: Final commit**

```bash
cd /Users/jongsu/claude-dotfiles && git add -A && git commit -m "feat: add build scripts and finalize CLI"
```

---

### Task 16: Test init on Real Config

**Step 1: Run init against your actual ~/.claude/**

Run: `cd /tmp && mkdir my-dotfiles && bun run /Users/jongsu/claude-dotfiles/src/index.ts init --output /tmp/my-dotfiles`

Provide when prompted:
- Name: "jongsu's claude setup"
- Description: "eBPF + Kubernetes focused setup with superpowers workflow"
- Author: "jongsu"
- Tags: "kubernetes,ebpf,superpowers,kotlin"

**Step 2: Verify exported files**

Run: `ls -la /tmp/my-dotfiles/`
Expected: `claude-dotfiles.json`, `settings.json`, `permissions.json`, `plugins.json`, `skills/`, `README.md`

**Step 3: Verify sensitive data was stripped**

Run: `cat /tmp/my-dotfiles/settings.json`
Expected: No absolute home paths (replaced with `~`), no API keys.

**Step 4: Clean up**

Run: `rm -rf /tmp/my-dotfiles /tmp/test-dotfiles`
