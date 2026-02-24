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
