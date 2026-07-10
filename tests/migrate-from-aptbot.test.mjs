import { describe, test, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  convertFrontmatter,
  rewriteImagePaths,
  migrateAll,
} from '../scripts/migrate-from-aptbot.mjs';

const tempDirs = [];

afterEach(async () => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    await rm(dir, { recursive: true, force: true });
  }
});

async function makeTempDir(prefix) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function makeTempSource(files) {
  const dir = await makeTempDir('aptblog-src-');
  for (const [name, content] of Object.entries(files)) {
    if (name.includes('/')) {
      const parts = name.split('/');
      const sub = path.join(dir, ...parts.slice(0, -1));
      await mkdir(sub, { recursive: true });
      await writeFile(path.join(dir, name), content);
    } else {
      await writeFile(path.join(dir, name), content, 'utf-8');
    }
  }
  return dir;
}

async function snapshotDir(dir) {
  const result = {};
  async function walk(d, rel = '') {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(full, r);
      } else {
        result[r] = (await readFile(full)).toString('base64');
      }
    }
  }
  await walk(dir);
  return result;
}

const ZH_PUBLISHED = `---
slug: "01-dev-workflow"
title: "AI 辅助开发工作流"
description: "四阶段流程"
track: ai-coding-practice
chapter: 方法论
order: 14
difficulty: beginner
estimatedReadingTime: 18
status: published
prerequisites: []
lastUpdated: "2026-07-02"
tags:
  - workflow
  - tdd
---

正文内容
`;

const EN_PUBLISHED = `---
slug: "01-dev-workflow"
title: "AI Dev Workflow"
description: "four phases"
track: ai-coding-practice
chapter: methodology
order: 14
difficulty: beginner
estimatedReadingTime: 18
status: published
prerequisites: []
lastUpdated: "2026-07-02"
tags:
  - workflow
---

body
`;

describe('convertFrontmatter', () => {
  test('published zh article maps fields and drops source-only fields', () => {
    const source = {
      slug: '01-dev-workflow',
      title: 'AI 辅助开发工作流',
      description: '四阶段流程',
      track: 'ai-coding-practice',
      chapter: '方法论',
      order: 14,
      difficulty: 'beginner',
      estimatedReadingTime: 18,
      status: 'published',
      prerequisites: [],
      lastUpdated: '2026-07-02',
      tags: ['workflow', 'tdd'],
    };
    const out = convertFrontmatter(source);

    expect(out.title).toBe(source.title);
    expect(out.description).toBe(source.description);
    expect(out.tags).toEqual(source.tags);
    expect(out.date).toBe('2026-07-02');
    expect(out.categories).toEqual(['ai-coding-practice', '方法论']);
    expect(out.difficulty).toBe('beginner');
    expect(out.reading_time).toBe(18);
    expect(out.prerequisites).toEqual([]);

    for (const key of ['order', 'track', 'chapter', 'status', 'lastUpdated', 'estimatedReadingTime']) {
      expect(out).not.toHaveProperty(key);
    }
  });
});

describe('rewriteImagePaths', () => {
  test('rewrites /learn/articles/images/ prefix to /images/<slug>/', () => {
    const content = '![AI 辅助开发工作流](/learn/articles/images/dev-workflow.png)';
    const out = rewriteImagePaths(content, '01-dev-workflow');
    expect(out).toBe('![AI 辅助开发工作流](/images/01-dev-workflow/dev-workflow.png)');
  });
});

describe('migrateAll output directories', () => {
  test('published english article goes to _posts-en not _posts', async () => {
    const sourceDir = await makeTempSource({ '01-dev-workflow.en.md': EN_PUBLISHED });
    const targetDir = await makeTempDir('aptblog-tgt-');
    await migrateAll({ sourceDir, targetSourceDir: targetDir, dryRun: false });

    const enPosts = await readdir(path.join(targetDir, '_posts-en'));
    const zhPosts = await readdir(path.join(targetDir, '_posts'));
    expect(enPosts).toContain('01-dev-workflow.md');
    expect(zhPosts).not.toContain('01-dev-workflow.md');
  });

  test('planned article goes to _drafts not _posts', async () => {
    const planned = ZH_PUBLISHED
      .replace('status: published', 'status: planned')
      .replace(/01-dev-workflow/g, '02-planned-article');
    const sourceDir = await makeTempSource({ '02-planned-article.md': planned });
    const targetDir = await makeTempDir('aptblog-tgt-');
    await migrateAll({ sourceDir, targetSourceDir: targetDir, dryRun: false });

    const drafts = await readdir(path.join(targetDir, '_drafts'));
    const posts = await readdir(path.join(targetDir, '_posts'));
    expect(drafts).toContain('02-planned-article.md');
    expect(posts).not.toContain('02-planned-article.md');
  });
});

describe('migrateAll dry-run', () => {
  test('dry-run creates no files, only prints to stdout', async () => {
    const sourceDir = await makeTempSource({ '01-dev-workflow.md': ZH_PUBLISHED });
    const targetDir = await makeTempDir('aptblog-tgt-');

    let printed = '';
    const origLog = console.log;
    console.log = (...args) => { printed += args.join(' ') + '\n'; };
    try {
      await migrateAll({ sourceDir, targetSourceDir: targetDir, dryRun: true });
    } finally {
      console.log = origLog;
    }

    for (const sub of ['_posts', '_posts-en', '_drafts', 'images']) {
      await expect(readdir(path.join(targetDir, sub))).rejects.toBeDefined();
    }
    expect(printed.length).toBeGreaterThan(0);
  });
});

describe('migrateAll idempotency', () => {
  test('second run produces identical results', async () => {
    const sourceDir = await makeTempSource({
      '01-dev-workflow.md': ZH_PUBLISHED,
      'images/dev-workflow.png': Buffer.from('fake-png-bytes'),
    });
    const targetDir = await makeTempDir('aptblog-tgt-');

    await migrateAll({ sourceDir, targetSourceDir: targetDir, dryRun: false });
    const first = await snapshotDir(targetDir);

    await migrateAll({ sourceDir, targetSourceDir: targetDir, dryRun: false });
    const second = await snapshotDir(targetDir);

    expect(second).toEqual(first);
    expect(first['_posts/01-dev-workflow.md']).toBeDefined();
    expect(first['images/01-dev-workflow/dev-workflow.png']).toBeDefined();
  });
});

describe('migrateAll missing source directory', () => {
  test('exits with non-zero code when source dir is missing', () => {
    const scriptPath = fileURLToPath(new URL('../scripts/migrate-from-aptbot.mjs', import.meta.url));
    let exitCode = 0;
    try {
      execFileSync('node', [scriptPath, '--source=/nonexistent/aptblog-path-xyz'], {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (e) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
  });
});

describe('migrateAll per-article error handling', () => {
  test('single article parse failure warns and skips, continues processing others', async () => {
    const broken = 'this has no frontmatter at all, just body text';
    const sourceDir = await makeTempSource({
      '01-valid-article.md': ZH_PUBLISHED.replace(/01-dev-workflow/g, '01-valid-article'),
      '99-broken-article.md': broken,
    });
    const targetDir = await makeTempDir('aptblog-tgt-');

    const warnSpy = [];
    const origWarn = console.warn;
    console.warn = (...args) => { warnSpy.push(args.join(' ')); };
    try {
      await migrateAll({ sourceDir, targetSourceDir: targetDir, dryRun: false });
    } finally {
      console.warn = origWarn;
    }

    const posts = await readdir(path.join(targetDir, '_posts'));
    expect(posts).toContain('01-valid-article.md');
    expect(posts).not.toContain('99-broken-article.md');
    expect(posts.length).toBe(1);
    expect(warnSpy.some((m) => m.includes('99-broken-article.md'))).toBe(true);
  });
});
