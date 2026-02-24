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
