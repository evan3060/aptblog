---
name: publish-post
description: Use when the user wants to publish a new blog post to aptblog. Handles the full workflow: create file with frontmatter, local preview, git push, CI auto-deploy, and online verification.
---

# Publish Post

Publish a new article to the aptblog Hexo site. This skill handles the complete publishing workflow from file creation to online verification.

## When to Use

Trigger when the user expresses intent to publish a blog post:
- "发布一篇新文章"
- "发一篇关于 X 的博客"
- "把这个内容发到 blog"
- "publish a new post"

## Prerequisites

- Hexo site initialized (`_config.yml` exists in project root)
- CI/CD configured (push to main triggers auto-deploy)
- Current working directory is the aptblog project root

## Workflow

### Step 1: Collect Article Information

Ask the user for (use AskUserQuestion if not provided):
- **Title** (required): article title
- **Content** (required): Markdown content
- **Language** (required): `zh` or `en` or `both` (default: `zh`)
- **Tags** (optional): array of tags
- **Categories** (optional): array, first item is level-1, second is level-2
- **Description** (optional): if not provided, extract from first paragraph
- **Slug** (optional): if not provided, generate from title (for Chinese titles, ask user or use pinyin/transliteration)
- **Draft mode** (optional): if user says "存草稿", write to `_drafts/` and do NOT push

### Step 2: Generate Frontmatter

Construct frontmatter with these fields:
- `title`: article title
- `date`: current date in `YYYY-MM-DD` format
- `tags`: from user input or empty array
- `categories`: from user input or empty array
- `description`: from user input or first paragraph excerpt
- `lang`: `zh` or `en`
- `permalink`: `<lang>/<slug>.html`
- `difficulty` (optional): from user input
- `reading_time` (optional): from user input

### Step 3: Write File

- Chinese article: `source/_posts/<slug>.md`
- English article: `source/_posts/<slug>.en.md`
- Draft: `source/_drafts/<slug>.md` (do NOT push)

Use the Write tool to create the file with frontmatter + content.

### Step 4: Local Preview

1. Run `npx hexo generate` to verify build succeeds (no ERROR)
2. If hexo server is not running, start it: `npx hexo server` (non-blocking)
3. Tell the user: "本地预览已就绪，请访问 http://localhost:4000/<lang>/<slug>.html 查看效果"
4. Wait for user confirmation before proceeding

### Step 5: Git Commit and Push

**For published posts (not drafts):**
```bash
git add source/_posts/<slug>.md  # or .en.md
git commit -m "post: <title>"
git checkout main
git merge feat/0.1.0 --no-edit  # or current working branch
git push origin main
git checkout feat/0.1.0  # switch back to working branch
```

**For drafts:** Skip this step entirely. Tell user the draft is saved at `source/_drafts/<slug>.md`.

### Step 6: Wait for CI

After push to main, GitHub Actions auto-deploys. Wait ~60 seconds, then check:
```bash
gh run list -R evan3060/aptblog --limit 1
```
Confirm the run status is `completed` and conclusion is `success`.

### Step 7: Online Verification

Verify the article is live:
```bash
curl -s -o /dev/null -w "%{http_code}" https://blog.aptbot.de/<lang>/<slug>.html
```
Expected: `200`

### Step 8: Report Results

Report to the user:
- Article URL: `https://blog.aptbot.de/<lang>/<slug>.html`
- CI status: success/failed
- HTTP status: 200/error
- Local preview URL (if server still running)

## Boundaries

- **Does NOT write content**: This skill publishes user-provided content. It does not generate article body text.
- **Does NOT handle wechatsync**: WeChat公众号同步是独立的浏览器手动操作。
- **Does NOT handle image uploads**: If the article references images, the user must place them in `source/images/<slug>/` manually before publishing.
- **Slug collision check**: Before writing, check if `source/_posts/<slug>.md` (or `.en.md`) already exists. If so, ask the user to choose a different slug.

## Error Handling

- **Build failure** (`hexo generate` ERROR): Report the error, do NOT push. Ask user to fix content.
- **Slug collision**: Ask user for a different slug.
- **git push failure**: Report error (network/permissions). Suggest checking network or SSH key.
- **CI timeout**: After 120 seconds, report timeout. Suggest user check GitHub Actions manually.
- **Online 404**: CI may still be running, or permalink misconfigured. Suggest checking Actions status and permalink field.
