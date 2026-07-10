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
const OUTPUT_DIRS = ['_posts', '_posts-en', 'images'];
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

export function convertFrontmatter(data) {
  return {
    title: data.title,
    description: data.description,
    tags: data.tags,
    date: formatDate(data.lastUpdated),
    categories: [data.track, data.chapter],
    difficulty: data.difficulty,
    reading_time: data.estimatedReadingTime,
    prerequisites: data.prerequisites,
  };
}

export function rewriteImagePaths(content, slug) {
  return content.split(IMAGE_PREFIX).join(`/images/${slug}/`);
}

export function getOutputDir(lang, status) {
  if (status === 'planned') return '_drafts';
  return lang === 'en' ? '_posts-en' : '_posts';
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
      const targetFm = convertFrontmatter(article.data);
      const rewritten = rewriteImagePaths(article.content, article.slug);
      const output = matter.stringify(rewritten, targetFm);
      const outDir = getOutputDir(article.lang, article.data.status);
      const outPath = path.join(targetSourceDir, outDir, `${article.slug}.md`);
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
