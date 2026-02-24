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
