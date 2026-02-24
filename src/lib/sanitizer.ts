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
