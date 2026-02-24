# claude-dotfiles Design

## Overview

A CLI tool that lets people share, discover, and install each other's Claude Code configurations. Every Claude Code user's setup is unique — their plugins, skills, CLAUDE.md instructions, permissions, and settings shape a distinct workflow. Experiencing someone else's setup is the fastest way to understand what's possible and get inspired to adopt AI-assisted development.

## Architecture

**Approach: Manifest-Based**

Each user publishes their Claude Code setup as a GitHub repo containing a `claude-dotfiles.json` manifest. The CLI reads this manifest to preview and install setups. No server required — GitHub is the registry.

**Tech Stack:**
- TypeScript + Bun
- `commander` for CLI framework
- `chalk` for terminal output
- `@inquirer/prompts` for interactive selection
- `zod` for manifest validation
- `gh` CLI for GitHub operations

## Manifest Format

```json
{
  "name": "jongsu's claude setup",
  "description": "eBPF + Kubernetes focused setup with superpowers workflow",
  "author": "jongsu",
  "version": "1.0.0",
  "components": {
    "plugins": { "include": true, "file": "plugins.json" },
    "settings": { "include": true, "file": "settings.json" },
    "permissions": { "include": true, "file": "permissions.json" },
    "skills": { "include": true, "dir": "skills/" },
    "claudeMd": { "include": true, "dir": "claude-md/" }
  },
  "tags": ["kubernetes", "ebpf", "superpowers", "kotlin"]
}
```

- Each component is optional — share just plugins, just CLAUDE.md, or everything.
- Permissions are separated from settings for granular sharing control.
- Tags enable discovery via GitHub topics and manifest search.

## Shareable Repo Structure

```
my-claude-dotfiles/
├── claude-dotfiles.json    # manifest
├── plugins.json            # plugin list with versions
├── settings.json           # global settings (sanitized)
├── permissions.json        # permission rules
├── skills/                 # custom skills
│   └── my-skill/SKILL.md
├── claude-md/              # CLAUDE.md templates
│   ├── global.md
│   └── project-template.md
└── README.md               # auto-generated summary
```

## CLI Commands

### `claude-dotfiles init`

Scans `~/.claude/` and generates a publishable repo:

1. Reads `settings.json` — strips sensitive fields (keys, tokens, secrets)
2. Reads `settings.local.json` — extracts permissions into `permissions.json`
3. Reads `installed_plugins.json` — generates `plugins.json` with names + versions
4. Copies custom skills from `~/.claude/skills/`
5. Prompts for CLAUDE.md files to include
6. Generates `claude-dotfiles.json` manifest
7. Generates a `README.md` summary
8. Warns about paths containing usernames, offers to anonymize
9. Shows full preview before finalizing

### `claude-dotfiles publish`

- Initializes git repo if needed
- Adds `claude-dotfiles` GitHub topic
- Pushes to GitHub via `gh` CLI

### `claude-dotfiles search [query]`

- Searches GitHub for repos with `claude-dotfiles` topic
- Displays: author, description, tags, component summary
- Filters by tags optionally

### `claude-dotfiles show <user/repo>`

- Fetches manifest from GitHub
- Pretty-prints: plugins, skills, settings overview, CLAUDE.md preview
- Shows diff against current setup ("you have 3/6 of these plugins")

### `claude-dotfiles install <user/repo>`

- Fetches the repo from GitHub
- Shows dry-run of what will change
- Interactive checkboxes to pick components
- Installs selected components using merge strategy
- Creates backup before any changes

### `claude-dotfiles rollback`

- Restores from the latest backup

## Safety

### Backup

Before any install, creates a timestamped backup:
```
~/.claude/backups/claude-dotfiles-<ISO-timestamp>/
├── settings.json
├── settings.local.json
├── installed_plugins.json
└── skills/
```

### Merge Strategy

- **Settings**: Deep merge. Existing keys preserved, new keys added. Conflicts shown to user.
- **Permissions**: Union merge. New `allow` rules appended, never removed.
- **Plugins**: Additive only. Installs missing plugins, never removes existing ones.
- **Skills**: Copies new skills. Prompts if name collision.
- **CLAUDE.md**: Never overwrites. Appends or creates new file with source header.

### Rollback

`claude-dotfiles rollback` restores from latest backup.

### Sensitive Data Protection (during `init`)

- Strips fields containing `key`, `token`, `secret`, `password`
- Warns about paths containing usernames
- Full preview before publishing

## Project Structure

```
claude-dotfiles/
├── src/
│   ├── index.ts              # CLI entry (Commander.js)
│   ├── commands/
│   │   ├── init.ts           # Export current setup
│   │   ├── publish.ts        # Push to GitHub
│   │   ├── search.ts         # Search GitHub repos
│   │   ├── show.ts           # Preview a setup
│   │   ├── install.ts        # Install a setup
│   │   └── rollback.ts       # Restore from backup
│   ├── lib/
│   │   ├── manifest.ts       # Parse/validate manifest
│   │   ├── scanner.ts        # Scan ~/.claude/ directory
│   │   ├── merger.ts         # Merge strategies
│   │   ├── backup.ts         # Backup/restore logic
│   │   ├── github.ts         # GitHub API via gh CLI
│   │   ├── sanitizer.ts      # Strip sensitive data
│   │   └── renderer.ts       # Terminal pretty-print
│   └── types.ts              # TypeScript types
├── package.json
├── tsconfig.json
├── bunfig.toml
└── tests/
    ├── scanner.test.ts
    ├── merger.test.ts
    └── sanitizer.test.ts
```

## Distribution

- `bun build --compile` for single binary
- npm publish as `claude-dotfiles`
- Install: `bun install -g claude-dotfiles` or `npm install -g claude-dotfiles`

## Discovery Mechanism

GitHub-native discovery:
- Repos tagged with `claude-dotfiles` topic
- `search` command queries GitHub API for this topic
- Manifest tags enable filtering (e.g., "show me all kubernetes-focused setups")
