# Plugin Skills Sharing — Design

**Goal:** When previewing someone's claude-dotfiles setup with `show`, display the skills that come from their installed plugins (not just local custom skills). During `init`, scan installed plugins for skills and export their names + descriptions to a `plugin-skills.json`.

**Architecture:** Extend the scanner to walk the plugin cache directory, parse SKILL.md YAML frontmatter from each plugin's skills, and export the metadata. The `show` and `init` commands display plugin skills grouped by plugin. No changes to install/merge — plugin skills are informational only (you install the plugin to get them).

## Data Model

New file `plugin-skills.json` in the export:

```json
[
  {
    "plugin": "superpowers",
    "marketplace": "claude-plugins-official",
    "version": "4.3.1",
    "skills": [
      { "name": "brainstorming", "description": "Use when starting any creative work..." },
      { "name": "test-driven-development", "description": "Use when implementing any feature..." }
    ]
  }
]
```

New types in `types.ts`:
- `PluginSkillEntry` — `{ name: string; description: string }`
- `PluginSkillGroup` — `{ plugin: string; marketplace: string; version: string; skills: PluginSkillEntry[] }`
- `ScanResult.pluginSkills` — `PluginSkillGroup[]`

New Zod schemas for validation.

New manifest component: `pluginSkills: { include: boolean; file: string }`.

## Scanner Changes

`scanner.ts` — new `scanPluginSkills(claudeDir)` function:
1. Read `installed_plugins.json` to get plugin install paths
2. For each plugin, check if `<installPath>/skills/` exists
3. If so, read each subdirectory's `SKILL.md`
4. Parse YAML frontmatter (between `---` delimiters) for `name` and `description`
5. Return `PluginSkillGroup[]`

Called from `scanClaudeDir()`, result stored in `ScanResult.pluginSkills`.

## Init Changes

`init.ts`:
- After listing plugins, show plugin skills grouped by plugin in scan summary
- Write `plugin-skills.json` if any plugin skills found
- Add `pluginSkills` component to manifest

## Show Changes

`show.ts` + `renderer.ts`:
- Fetch `plugin-skills.json` from remote repo (via `fetchFile()`)
- New `renderPluginSkills(groups)` function in renderer
- Display in a "Plugin Skills" section, distinct from "Custom Skills"

## README Generation

`generateReadme()` in `init.ts`:
- Add "### Plugin Skills" section
- List skills grouped by plugin with descriptions

## Export Structure

```
my-claude-dotfiles/
├── claude-dotfiles.json
├── plugins.json
├── plugin-skills.json    ← NEW
├── settings.json
├── permissions.json
├── skills/
│   └── my-skill/SKILL.md
└── README.md
```

## What Doesn't Change

- `install` command — plugin skills are informational, not installable (user installs the plugin itself)
- `merger.ts` — no merge logic needed for plugin skills
- `backup.ts` / `rollback.ts` — no changes
- `publish.ts` / `search.ts` — no changes

## YAML Frontmatter Parsing

Simple parser (no dependency):
1. Check if file starts with `---\n`
2. Find closing `---\n`
3. Split lines, match `key: value` or `key: "value"`
4. Extract `name` and `description`
