# claude-dotfiles

**Share, discover, and install Claude Code configurations.**

Every Claude Code user's setup is different — plugins, skills, permissions, CLAUDE.md instructions, and settings all shape a unique workflow. `claude-dotfiles` makes it easy to share yours and learn from others.

<p align="center">
  <img src="demo/demo.gif" alt="claude-dotfiles demo" width="720">
</p>

## Why?

You spend hours configuring Claude Code — installing plugins like `superpowers`, `claude-hud`, and `context7`, writing custom skills, tuning permissions. But nobody else can see your setup. And when you see someone doing something amazing with Claude Code, you can't easily replicate their workflow.

**claude-dotfiles fixes this.** It's like [dotfiles](https://dotfiles.github.io/) for Claude Code:

- **Export** your `~/.claude/` config into a clean, shareable format
- **Discover** how others use Claude Code by searching GitHub
- **Install** someone else's setup with one command (merge, never overwrite)
- **Rollback** if you don't like the changes

## Install

```bash
# With bun (recommended)
bun install -g claude-dotfiles

# With npm
npm install -g claude-dotfiles
```

Or clone and link:

```bash
git clone https://github.com/pjs7678/claude-dotfiles.git
cd claude-dotfiles
bun install && bun link
```

## Quick Start

### 1. Export your setup

```bash
claude-dotfiles init
```

This scans your `~/.claude/` directory and generates a publishable package:

- **Plugins** — which plugins you use and their versions
- **Settings** — your `settings.json` (sensitive data auto-stripped)
- **Permissions** — your permission rules from `settings.local.json`
- **Skills** — custom skills from `~/.claude/skills/`
- **CLAUDE.md** — your instruction files

You can also run it non-interactively:

```bash
claude-dotfiles init \
  -o ./my-setup \
  -n "my claude setup" \
  -d "Full-stack TypeScript with superpowers" \
  -a "your-github-username" \
  -t "typescript,react,superpowers"
```

### 2. Publish to GitHub

```bash
claude-dotfiles publish
```

Creates a GitHub repo with the `claude-dotfiles` topic so others can discover it.

### 3. Discover setups

```bash
claude-dotfiles search
claude-dotfiles search "kubernetes"
```

Searches GitHub for repos tagged with `claude-dotfiles`.

### 4. Preview a setup

```bash
claude-dotfiles show pjs7678/my-claude-dotfiles
```

Shows what plugins, skills, settings, and permissions are in a setup — and compares against your current config.

### 5. Install a setup

```bash
claude-dotfiles install pjs7678/my-claude-dotfiles
```

Interactively pick which components to install. Everything is **merged, never overwritten**:

| Component | Strategy |
|-----------|----------|
| Settings | Deep merge — your existing keys preserved, new keys added |
| Permissions | Union — new rules appended, nothing removed |
| Plugins | Additive — installs missing plugins only |
| Skills | Copy — prompts on name collision |
| CLAUDE.md | Append — never overwrites existing files |

A backup is created automatically before any changes.

### 6. Rollback

```bash
claude-dotfiles rollback
```

Restore your config from a timestamped backup.

## What Gets Shared

When you run `init`, your config is **sanitized before export**:

- Fields containing `key`, `token`, `secret`, `password` are stripped
- Home directory paths (`/Users/you/`) are replaced with `~`
- You see a full preview before anything is written

**Example exported structure:**

```
my-claude-dotfiles/
├── claude-dotfiles.json    # manifest (name, description, components, tags)
├── plugins.json            # plugin list with versions
├── settings.json           # settings (sanitized)
├── permissions.json        # permission rules
├── skills/                 # custom skills
│   └── my-skill/SKILL.md
└── README.md               # auto-generated
```

## When to Use This

| Situation | What to do |
|-----------|------------|
| "I want to share my Claude Code workflow" | `claude-dotfiles init && claude-dotfiles publish` |
| "I saw someone's cool Claude setup on Twitter" | `claude-dotfiles show user/repo` then `install` |
| "I'm setting up Claude Code on a new machine" | `claude-dotfiles install your-username/your-dotfiles` |
| "I want to see how others configure Claude" | `claude-dotfiles search` |
| "I installed something and want to undo it" | `claude-dotfiles rollback` |

## Commands

| Command | Description |
|---------|-------------|
| `claude-dotfiles init` | Export your current Claude Code setup |
| `claude-dotfiles publish` | Push your setup to GitHub |
| `claude-dotfiles search [query]` | Search for setups on GitHub |
| `claude-dotfiles show <user/repo>` | Preview a setup + diff against yours |
| `claude-dotfiles install <user/repo>` | Install a setup with selective merge |
| `claude-dotfiles rollback` | Restore from backup |

## Motivation

Claude Code is transforming how developers work. But every user's experience is shaped by their configuration — and right now, there's no way to share that. You can't browse someone else's plugin stack, see their custom skills, or try their permission setup.

The [dotfiles](https://dotfiles.github.io/) tradition in Unix showed that sharing configs creates a virtuous cycle: people discover tools they didn't know existed, learn patterns from experienced users, and the whole community levels up.

`claude-dotfiles` brings that same culture to Claude Code. When you can see that someone uses `superpowers` + `claude-hud` + `context7` together, or that they've written a custom skill for code review — you learn what's possible and get inspired to improve your own workflow.

The best way to get someone excited about Claude Code is to show them a great setup in action.

## Contributing

Contributions welcome! This project is built with TypeScript + Bun.

```bash
git clone https://github.com/pjs7678/claude-dotfiles.git
cd claude-dotfiles
bun install
bun test        # 19 tests
bun run dev     # run CLI locally
```

## License

MIT
