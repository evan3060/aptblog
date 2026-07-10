import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { filterPostsByLang, buildEnPath, buildZhPath } = require('../scripts/i18n.cjs');

describe('filterPostsByLang', () => {
  const posts = [
    { title: '中文文章', lang: 'zh-CN' },
    { title: 'English post', lang: 'en' },
    { title: '无 lang 字段文章' },
    { title: '空 lang 文章', lang: '' },
  ];

  test('lang=en returns only posts with lang === "en"', () => {
    const result = filterPostsByLang(posts, 'en');
    expect(result).toEqual([{ title: 'English post', lang: 'en' }]);
  });

  test('lang=zh-CN returns posts with lang === "zh-CN" plus posts with no/empty lang', () => {
    const result = filterPostsByLang(posts, 'zh-CN');
    expect(result).toEqual([
      { title: '中文文章', lang: 'zh-CN' },
      { title: '无 lang 字段文章' },
      { title: '空 lang 文章', lang: '' },
    ]);
  });
});

describe('buildEnPath', () => {
  test('root path "/" becomes "/en/"', () => {
    expect(buildEnPath('/')).toBe('/en/');
  });

  test('post path "/01-dev-workflow.html" becomes "/en/01-dev-workflow.html"', () => {
    expect(buildEnPath('/01-dev-workflow.html')).toBe('/en/01-dev-workflow.html');
  });

  test('archive path "/archives/" becomes "/en/archives/"', () => {
    expect(buildEnPath('/archives/')).toBe('/en/archives/');
  });
});

describe('buildZhPath', () => {
  test('english root "/en/" becomes "/"', () => {
    expect(buildZhPath('/en/')).toBe('/');
  });

  test('english post "/en/01-dev-workflow.html" becomes "/01-dev-workflow.html"', () => {
    expect(buildZhPath('/en/01-dev-workflow.html')).toBe('/01-dev-workflow.html');
  });

  test('english archive "/en/archives/" becomes "/archives/"', () => {
    expect(buildZhPath('/en/archives/')).toBe('/archives/');
  });

  test('path without en prefix is returned as-is', () => {
    expect(buildZhPath('/01-dev-workflow.html')).toBe('/01-dev-workflow.html');
  });
});
