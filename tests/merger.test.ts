import { describe, test, expect } from "bun:test";
import { mergeSettings, mergePermissions } from "../src/lib/merger";

describe("mergeSettings", () => {
  test("deep merges without overwriting existing keys", () => {
    const existing = { statusLine: { type: "command" }, model: "opus" };
    const incoming = { statusLine: { type: "text" }, theme: "dark" };
    const { merged, conflicts } = mergeSettings(existing, incoming);
    expect(merged.statusLine.type).toBe("command");
    expect(merged.theme).toBe("dark");
    expect(conflicts).toHaveLength(1);
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
