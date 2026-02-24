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
      pluginSkills: [],
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
      pluginSkills: [],
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
    expect(manifest.components.pluginSkills).toBeUndefined();
  });

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
