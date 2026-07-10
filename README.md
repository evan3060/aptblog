<div align="center">
  <p>
    <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version">
    <img src="https://img.shields.io/badge/Hexo-8.x-orange" alt="Hexo">
    <img src="https://img.shields.io/badge/theme-NexT-ff69b4" alt="Theme">
    <img src="https://img.shields.io/badge/license-MIT-yellow" alt="License">
  </p>
  <p>
    <a href="./README.md">English</a> |
    <a href="./README.zh-CN.md">简体中文</a>
  </p>
</div>

📝 **aptblog — AI Practice Blog**

An independent tech blog extended from the [aptbot](https://github.com/evan3060/aptbot) project, focused on the distillation and sharing of **Agent practices** and **AI coding experience**.

It's not a general-purpose blog. It's a knowledge base born from real engineering practice — 18 in-depth articles covering agent architecture design, AI coding workflow, and system evolution. Every article is written in both Chinese and English, with a global language switcher that keeps the entire UI consistent in your chosen language.

**Goal:** Document the journey of building and iterating on an AI assistant, so others can learn from the architecture decisions, workflow constraints, and pitfalls encountered along the way.

> **Status:** v0.1.0 — Content migration (18 articles × 2 languages) + full i18n with sliding toggle switch + CI/CD auto-deployment + bilingual categories/tags. Human UAT passed.

## Start Here

| You want to... | Go to |
|---|---|
| Read the blog | [https://blog.aptbot.de/](https://blog.aptbot.de/) |
| Switch language | Click the 中/EN toggle in the top menu |
| See what changed between versions | [Changelog](./CHANGELOG.md) |
| Migrate content from aptbot | [Migration Script](./tools/migrate-from-aptbot.mjs) |
| Review the i18n design | [Spec](./docs/superpowers/specs/2026-07-10-i18n-redesign-design.md) |
| Review the implementation plan | [Plan](./docs/superpowers/plans/2026-07-10-i18n-redesign.md) |

## 🌐 i18n

aptblog implements full bilingual support using a path-prefix scheme:

- **Chinese** (default): `/` — no prefix, e.g. `https://blog.aptbot.de/01-dev-workflow.html`
- **English**: `/en/` — prefix, e.g. `https://blog.aptbot.de/en/01-dev-workflow.html`

### How it works

- Custom Hexo generators produce separated Chinese/English pages for index, archives, categories, and tags
- A `template_locals` filter (priority 20) overrides `title`, `subtitle`, and `description` for English pages
- `list_categories` and `tagcloud` helpers are overridden to filter by `page.lang`
- Theme partial cache is disabled to prevent cross-language cache pollution
- A sliding toggle switch in the menu bar lets users switch language instantly, with `localStorage` persistence and first-visit browser language detection

## 📖 Content

18 articles in two tracks, each available in Chinese and English:

| Track | Articles | Topics |
|---|---|---|
| Agent Practice | 12 | What is an agent, aptbot architecture, provider/tool/memory/skills/hook/channel/session/security internals, error/streaming UX, future roadmap |
| AI Coding Practice | 6 | Dev workflow, coding accuracy, spec document management, long-term iteration, boundary issues, continuous improvement |

## 🏗️ Tech Stack

| Component | Technology |
|---|---|
| Static site generator | Hexo 8.x |
| Theme | hexo-theme-next 8.28.0 (Gemini scheme) |
| i18n | Path-prefix scheme + custom generators + overridden helpers |
| CI/CD | GitHub Actions + rsync to VPS |
| SSL | Let's Encrypt via nginx |
| Testing | Vitest (18 unit tests) |

## 🚀 Local Development

Prerequisites: Node.js 20+ and npm.

```bash
git clone https://github.com/evan3060/aptblog.git
cd aptblog
npm install
```

### Run the dev server

```bash
npx hexo server --port 4000
```

Visit [http://localhost:4000/](http://localhost:4000/) for the Chinese site, or [http://localhost:4000/en/](http://localhost:4000/en/) for English.

### Build for production

```bash
npx hexo clean && npx hexo generate
```

Output goes to `public/`.

### Run tests

```bash
npx vitest run
```

## 📦 Content Migration

Articles are migrated from the aptbot project's `src/learn/articles/` directory using an automated script:

```bash
node tools/migrate-from-aptbot.mjs
```

The script:
- Reads source articles (Chinese `.md` + English `.en.md`)
- Converts frontmatter: adds `lang` field, sets `permalink` for English, translates categories/tags for Chinese
- Rewrites image paths from `/learn/articles/images/` to `/images/<slug>/`
- Is idempotent — safe to run repeatedly

## 🔧 Project Structure

```
aptblog/
├── _config.yml              # Hexo config (title, language, permalink)
├── _config.next.yml         # NexT theme config (motion, custom_file_path, cache)
├── scripts/
│   └── i18n.cjs             # Custom generators + helpers + template_locals filter
├── source/
│   ├── _posts/              # 18 zh-CN (.md) + 18 en (.en.md) articles
│   ├── _data/               # Custom injected files (header, bodyEnd, styles)
│   ├── about/               # Chinese about page
│   ├── en/                  # English pages (about, categories, tags)
│   └── images/              # Article images organized by slug
├── tools/
│   └── migrate-from-aptbot.mjs  # Content migration script
├── tests/                   # Vitest unit tests
├── docs/superpowers/        # Specs and plans
└── .github/workflows/       # CI/CD pipeline
```

## 📝 License

MIT
