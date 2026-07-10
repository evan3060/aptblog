import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readdir, rm, mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.resolve(PROJECT_ROOT, '../aptbot/src/learn/articles/');
const DEFAULT_TARGET = path.resolve(PROJECT_ROOT, 'source');
// Per spec §3.6, only these target dirs are cleared each run. _drafts is NOT
// cleared — it may hold hand-written drafts unrelated to this migration; draft
// files written here are made idempotent by overwriting the same slug filename.
const OUTPUT_DIRS = ['_posts', 'images'];
const IMAGE_PREFIX = '/learn/articles/images/';

export function parseArticle(rawContent, filename) {
  const parsed = matter(rawContent);
  if (!parsed.data || parsed.data.slug == null) {
    throw new Error('missing slug in frontmatter');
  }
  const lang = filename.endsWith('.en.md') ? 'en' : 'zh';
  return {
    data: parsed.data,
    content: parsed.content,
    lang,
    slug: parsed.data.slug,
  };
}

function formatDate(value) {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function convertFrontmatter(data, lang) {
  // Translate top-level category for Chinese articles
  const CATEGORY_ZH_MAP = {
    'agent-practice': 'Agent实践',
    'ai-coding-practice': 'AI编程实践',
  };
  // Standardize inconsistent English sub-category names
  const EN_SUBCATEGORY_FIX = {
    'Core Features Deep Dive': 'Deep Dive into Core Features',
  };
  // Translate tags to Chinese for Chinese articles
  const TAG_ZH_MAP = {
    'workflow': '工作流',
    'tdd': 'TDD',
    'constraints': '约束',
    'methodology': '方法论',
    'agent': 'Agent',
    'fundamentals': '基础概念',
    'react-loop': 'React循环',
    'architecture': '架构',
    'layered-design': '分层设计',
    'aptbot': 'aptbot',
    'dependency-injection': '依赖注入',
    'testing': '测试',
    'uat': 'UAT',
    'version-control': '版本控制',
    'quality': '质量',
    'provider': 'Provider',
    'streaming': '流式传输',
    'retry': '重试',
    'failover': '故障转移',
    'llm': 'LLM',
    'spec': '规范',
    'documentation': '文档',
    'lifecycle': '生命周期',
    'design': '设计',
    'iteration': '迭代',
    'maintenance': '维护',
    'tool': '工具',
    'security': '安全',
    'registry': '注册表',
    'schema-validation': 'Schema校验',
    'boundary': '边界',
    'pitfalls': '陷阱',
    'human-in-loop': '人工介入',
    'memory': '记忆',
    'jsonl': 'JSONL',
    'compaction': '压缩',
    'persistence': '持久化',
    'collaboration': '协作',
    'learning': '学习',
    'knowledge': '知识',
    'skills': 'Skills',
    'system-prompt': '系统提示',
    'hot-reload': '热重载',
    'token-management': 'Token管理',
    'hook': 'Hook',
    'plugin': '插件',
    'extensibility': '可扩展性',
    'channel': '通道',
    'transport': '传输',
    'websocket': 'WebSocket',
    'multi-client': '多客户端',
    'event-bus': '事件总线',
    'session': '会话',
    'multi-user': '多用户',
    'cache': '缓存',
    'isolation': '隔离',
    'trust-boundary': '信任边界',
    'defense-in-depth': '纵深防御',
    'authentication': '认证',
    'error-handling': '错误处理',
    'event-stream': '事件流',
    'reducer': 'Reducer',
    'ux': '用户体验',
    'roadmap': '路线图',
    'future': '未来',
    'mcp': 'MCP',
    'autonomous': '自主',
  };

  let categories;
  let tags;
  if (lang === 'zh') {
    const topCat = CATEGORY_ZH_MAP[data.track] || data.track;
    categories = [topCat, data.chapter];
    tags = (data.tags || []).map(t => TAG_ZH_MAP[t] || t);
  } else {
    const subCat = EN_SUBCATEGORY_FIX[data.chapter] || data.chapter;
    categories = [data.track, subCat];
    tags = data.tags;
  }

  const out = {
    title: data.title,
    description: data.description,
    tags,
    date: formatDate(data.lastUpdated),
    categories,
    difficulty: data.difficulty,
    reading_time: data.estimatedReadingTime,
    prerequisites: data.prerequisites,
    lang: lang === 'zh' ? 'zh-CN' : lang,
  };
  if (lang === 'en') {
    out.permalink = `en/${data.slug}.html`;
  }
  return out;
}

export function rewriteImagePaths(content, slug) {
  return content.split(IMAGE_PREFIX).join(`/images/${slug}/`);
}

export function getOutputDir(lang, status) {
  if (status === 'planned') return '_drafts';
  return '_posts';
}

// English articles use .en.md suffix to avoid filename collision with Chinese
// counterparts (both share the same slug). The permalink is set in frontmatter
// so the URL is clean: en/<slug>.html (not en/<slug>.en.html).
export function getOutputFilename(slug, lang) {
  return lang === 'en' ? `${slug}.en.md` : `${slug}.md`;
}

export function matchImageToSlug(imageBaseName, slugs) {
  const stem = imageBaseName.replace(/-gpt$/, '');
  return slugs.find((slug) => slug.includes(stem) || stem.includes(slug)) || null;
}

// Build a map from image filename (e.g. "react-loop.png") to the slug of the
// article that references it, by scanning article content for image refs.
// This is more accurate than filename-based matching: e.g. agent-architecture.png
// is referenced by 01-what-is-agent, but the names share no substring.
export function buildImageRefMap(articleContents) {
  // articleContents: array of { slug, content }
  const map = new Map();
  const refRegex = /\/learn\/articles\/images\/([a-zA-Z0-9_-]+\.png)/g;
  for (const { slug, content } of articleContents) {
    let match;
    while ((match = refRegex.exec(content)) !== null) {
      const imgName = match[1];
      if (!map.has(imgName)) {
        map.set(imgName, slug);
      }
    }
  }
  return map;
}

export async function migrateAll({ sourceDir, targetSourceDir, dryRun = false }) {
  await access(sourceDir);

  const outputDirs = OUTPUT_DIRS.map((d) => path.join(targetSourceDir, d));
  if (!dryRun) {
    for (const dir of outputDirs) {
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
    }
  }

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

  let processed = 0;
  let skipped = 0;
  const articleContents = [];

  for (const file of mdFiles) {
    const filePath = path.join(sourceDir, file.name);
    try {
      const raw = await readFile(filePath, 'utf-8');
      const article = parseArticle(raw, file.name);
      const targetFm = convertFrontmatter(article.data, article.lang);
      const rewritten = rewriteImagePaths(article.content, article.slug);
      const output = matter.stringify(rewritten, targetFm);
      const outDir = getOutputDir(article.lang, article.data.status);
      const outName = getOutputFilename(article.slug, article.lang);
      const outPath = path.join(targetSourceDir, outDir, outName);
      articleContents.push({ slug: article.slug, content: article.content });
      if (dryRun) {
        console.log(`[dry-run] would write ${path.relative(targetSourceDir, outPath)}`);
      } else {
        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, output, 'utf-8');
      }
      processed += 1;
    } catch (err) {
      console.warn(`warn: skipping ${file.name}: ${err.message}`);
      skipped += 1;
    }
  }

  const imagesDir = path.join(sourceDir, 'images');
  try {
    await access(imagesDir);
    const imgFiles = (await readdir(imagesDir)).filter((f) => f.endsWith('.png'));
    // Build image->slug map from actual article references (more accurate than
    // filename matching). Falls back to filename matching for unreferenced imgs.
    const refMap = buildImageRefMap(articleContents);
    for (const img of imgFiles) {
      // For gpt variants (xxx-gpt.png), the article references the base (xxx.png).
      // Strip -gpt suffix to look up the referenced slug, so gpt variants land
      // in the same slug directory as their human-authored counterpart.
      const lookupName = img.replace(/-gpt\.png$/, '.png');
      const matched = refMap.get(img) || refMap.get(lookupName) || matchImageToSlug(img.replace(/\.png$/, ''), articleContents.map((a) => a.slug));
      const destSub = matched ? path.join('images', matched) : path.join('images', 'misc');
      const destPath = path.join(targetSourceDir, destSub, img);
      if (dryRun) {
        console.log(`[dry-run] would copy ${img} -> ${path.relative(targetSourceDir, destPath)}`);
      } else {
        await mkdir(path.dirname(destPath), { recursive: true });
        await copyFile(path.join(imagesDir, img), destPath);
      }
    }
  } catch (err) {
    // images dir missing — skip image migration
  }

  console.log(`migrated ${processed} articles, skipped ${skipped}`);
  return { processed, skipped };
}

export function parseArgs(argv) {
  const args = { source: DEFAULT_SOURCE, dryRun: false };
  for (const arg of argv) {
    if (arg.startsWith('--source=')) {
      args.source = arg.slice('--source='.length);
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const stats = await migrateAll({
      sourceDir: args.source,
      targetSourceDir: DEFAULT_TARGET,
      dryRun: args.dryRun,
    });
    return stats;
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
