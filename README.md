# claude-dotfiles

**Share, discover, and install Claude Code configurations.**

Every Claude Code user's setup is different — plugins, skills, permissions, CLAUDE.md instructions, and settings all shape a unique workflow. `claude-dotfiles` makes it easy to share yours and learn from others.

<p align="center">
  <img src="demo/demo.gif" alt="claude-dotfiles demo" width="720">
</p>

<p align="center">
  <a href="#korean">한국어</a>
</p>

---

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

---

<a id="korean"></a>

# claude-dotfiles (한국어)

**Claude Code 설정을 공유하고, 탐색하고, 설치하세요.**

모든 Claude Code 사용자의 환경은 다릅니다 — 플러그인, 스킬, 권한 설정, CLAUDE.md 지시문, 그리고 설정 파일이 각자만의 고유한 워크플로우를 만들어냅니다. `claude-dotfiles`는 내 설정을 쉽게 공유하고, 다른 사람의 설정에서 배울 수 있게 해줍니다.

<p align="center">
  <img src="demo/demo.gif" alt="claude-dotfiles 데모" width="720">
</p>

## 왜 만들었나요?

Claude Code를 설정하는 데 많은 시간을 투자합니다 — `superpowers`, `claude-hud`, `context7` 같은 플러그인을 설치하고, 커스텀 스킬을 만들고, 권한을 세밀하게 조정합니다. 하지만 다른 사람은 내 설정을 볼 수 없습니다. 누군가 Claude Code로 멋진 작업을 하는 걸 봐도, 그 워크플로우를 쉽게 따라할 수 없죠.

**claude-dotfiles가 이 문제를 해결합니다.** Unix의 [dotfiles](https://dotfiles.github.io/) 문화를 Claude Code에 가져왔습니다:

- **내보내기** — `~/.claude/` 설정을 깔끔하고 공유 가능한 형태로 추출
- **탐색** — GitHub에서 다른 사람들의 Claude Code 설정을 검색
- **설치** — 한 줄 명령으로 다른 사람의 설정 적용 (병합 방식, 덮어쓰기 없음)
- **롤백** — 마음에 안 들면 원래 상태로 복원

## 설치

```bash
# bun으로 설치 (권장)
bun install -g claude-dotfiles

# npm으로 설치
npm install -g claude-dotfiles
```

또는 직접 클론:

```bash
git clone https://github.com/pjs7678/claude-dotfiles.git
cd claude-dotfiles
bun install && bun link
```

## 빠른 시작

### 1. 내 설정 내보내기

```bash
claude-dotfiles init
```

`~/.claude/` 디렉토리를 스캔하고 공유 가능한 패키지를 생성합니다:

- **플러그인** — 사용 중인 플러그인과 버전
- **설정** — `settings.json` (민감한 데이터는 자동으로 제거)
- **권한** — `settings.local.json`의 권한 규칙
- **스킬** — `~/.claude/skills/`의 커스텀 스킬
- **CLAUDE.md** — 지시문 파일

비대화형으로도 실행 가능합니다:

```bash
claude-dotfiles init \
  -o ./my-setup \
  -n "내 claude 설정" \
  -d "TypeScript 풀스택 with superpowers" \
  -a "github-사용자명" \
  -t "typescript,react,superpowers"
```

### 2. GitHub에 게시

```bash
claude-dotfiles publish
```

`claude-dotfiles` 토픽이 붙은 GitHub 저장소를 생성하여 다른 사람이 발견할 수 있게 합니다.

### 3. 설정 탐색

```bash
claude-dotfiles search
claude-dotfiles search "kubernetes"
```

GitHub에서 `claude-dotfiles` 토픽으로 태그된 저장소를 검색합니다.

### 4. 설정 미리보기

```bash
claude-dotfiles show pjs7678/my-claude-dotfiles
```

플러그인, 스킬, 설정, 권한 등을 확인하고 — 내 현재 설정과 비교합니다.

### 5. 설정 설치

```bash
claude-dotfiles install pjs7678/my-claude-dotfiles
```

설치할 구성 요소를 대화형으로 선택합니다. 모든 것은 **병합 방식이며, 절대 덮어쓰지 않습니다**:

| 구성 요소 | 전략 |
|-----------|------|
| 설정 | 딥 머지 — 기존 키 보존, 새 키만 추가 |
| 권한 | 유니온 — 새 규칙 추가, 기존 규칙 제거 없음 |
| 플러그인 | 추가만 — 없는 플러그인만 설치 |
| 스킬 | 복사 — 이름 충돌 시 확인 |
| CLAUDE.md | 추가 — 기존 파일 덮어쓰기 없음 |

변경 전 자동으로 백업이 생성됩니다.

### 6. 롤백

```bash
claude-dotfiles rollback
```

타임스탬프가 찍힌 백업에서 설정을 복원합니다.

## 공유되는 내용

`init` 실행 시 설정은 **내보내기 전에 정리됩니다**:

- `key`, `token`, `secret`, `password`가 포함된 필드는 제거
- 홈 디렉토리 경로(`/Users/you/`)는 `~`로 대체
- 최종 내보내기 전에 전체 미리보기를 확인

**내보내기 구조 예시:**

```
my-claude-dotfiles/
├── claude-dotfiles.json    # 매니페스트 (이름, 설명, 구성 요소, 태그)
├── plugins.json            # 플러그인 목록과 버전
├── settings.json           # 설정 (정리됨)
├── permissions.json        # 권한 규칙
├── skills/                 # 커스텀 스킬
│   └── my-skill/SKILL.md
└── README.md               # 자동 생성
```

## 언제 사용하나요?

| 상황 | 할 일 |
|------|-------|
| "내 Claude Code 워크플로우를 공유하고 싶어" | `claude-dotfiles init && claude-dotfiles publish` |
| "트위터에서 본 멋진 Claude 설정을 써보고 싶어" | `claude-dotfiles show user/repo` 후 `install` |
| "새 맥북에서 Claude Code를 세팅해야 해" | `claude-dotfiles install 내-계정/my-dotfiles` |
| "다른 사람들은 Claude를 어떻게 쓰는지 궁금해" | `claude-dotfiles search` |
| "설치한 걸 되돌리고 싶어" | `claude-dotfiles rollback` |

## 명령어

| 명령어 | 설명 |
|--------|------|
| `claude-dotfiles init` | 현재 Claude Code 설정 내보내기 |
| `claude-dotfiles publish` | GitHub에 설정 게시 |
| `claude-dotfiles search [검색어]` | GitHub에서 설정 검색 |
| `claude-dotfiles show <user/repo>` | 설정 미리보기 + 내 설정과 비교 |
| `claude-dotfiles install <user/repo>` | 선택적 병합으로 설정 설치 |
| `claude-dotfiles rollback` | 백업에서 복원 |

## 만든 이유

Claude Code는 개발자의 작업 방식을 바꾸고 있습니다. 하지만 모든 사용자의 경험은 설정에 의해 결정되고 — 지금은 그걸 공유할 방법이 없습니다. 다른 사람의 플러그인 조합을 둘러보거나, 커스텀 스킬을 살펴보거나, 권한 설정을 시도해볼 수 없죠.

Unix의 [dotfiles](https://dotfiles.github.io/) 전통은 설정을 공유하면 선순환이 만들어진다는 걸 보여줬습니다: 사람들은 몰랐던 도구를 발견하고, 숙련된 사용자의 패턴을 배우고, 커뮤니티 전체가 성장합니다.

`claude-dotfiles`는 그 문화를 Claude Code에 가져옵니다. 누군가가 `superpowers` + `claude-hud` + `context7`을 함께 쓰는 걸 보거나, 코드 리뷰를 위한 커스텀 스킬을 만들어 쓰는 걸 보면 — 무엇이 가능한지 알게 되고, 내 워크플로우를 개선할 영감을 얻게 됩니다.

**누군가를 Claude Code에 빠지게 하는 가장 좋은 방법은, 잘 꾸며진 설정이 실제로 작동하는 모습을 보여주는 것입니다.**

## 기여

기여를 환영합니다! TypeScript + Bun으로 빌드되었습니다.

```bash
git clone https://github.com/pjs7678/claude-dotfiles.git
cd claude-dotfiles
bun install
bun test        # 19개 테스트
bun run dev     # 로컬에서 CLI 실행
```

## 라이선스

MIT
