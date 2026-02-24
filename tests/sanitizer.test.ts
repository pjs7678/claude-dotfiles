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
    expect((result.nested as any).deep.password).toBeUndefined();
    expect((result.nested as any).deep.name).toBe("ok");
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
