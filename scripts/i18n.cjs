'use strict';

const pagination = require('hexo-pagination');

/**
 * Filter posts by language.
 * - lang === 'en': returns posts with lang === 'en'
 * - lang === 'zh-CN': returns posts with lang === 'zh-CN' or no/empty lang
 */
function filterPostsByLang(posts, lang) {
  if (lang === 'en') {
    return posts.filter(post => post.lang === 'en');
  }
  return posts.filter(post => !post.lang || post.lang === 'zh-CN');
}

/**
 * Build English version path by prepending /en.
 * '/' -> '/en/'
 * '/01-dev-workflow.html' -> '/en/01-dev-workflow.html'
 * '/archives/' -> '/en/archives/'
 */
function buildEnPath(currentPath) {
  return '/en' + currentPath;
}

/**
 * Build Chinese version path by stripping /en prefix.
 * '/en/' -> '/'
 * '/en/01-dev-workflow.html' -> '/01-dev-workflow.html'
 * '/01-dev-workflow.html' (no en prefix) -> '/01-dev-workflow.html'
 */
function buildZhPath(currentPath) {
  if (currentPath.startsWith('/en/')) {
    return currentPath.slice(3);
  }
  return currentPath;
}

module.exports = { filterPostsByLang, buildEnPath, buildZhPath };

// Register Hexo generators and filter only when hexo is available
if (typeof hexo !== 'undefined') {
  // Override default index generator: show only Chinese posts
  hexo.extend.generator.register('index', function(locals) {
    const config = this.config;
    const paginationDir = config.pagination_dir || 'page';
    const path = config.index_generator.path || '';
    const posts = locals.posts.sort(config.index_generator.order_by);
    const zhPosts = filterPostsByLang(posts, 'zh-CN');
    zhPosts.data.sort((a, b) => (b.sticky || 0) - (a.sticky || 0));

    return pagination(path, zhPosts, {
      perPage: config.index_generator.per_page,
      layout: config.index_generator.layout || ['index', 'archive'],
      format: paginationDir + '/%d/',
      data: {
        __index: true,
        lang: 'zh-CN'
      }
    });
  });

  // English index generator: /en/index.html
  hexo.extend.generator.register('en-index', function(locals) {
    const config = this.config;
    const paginationDir = config.pagination_dir || 'page';
    const posts = locals.posts.sort(config.index_generator.order_by);
    const enPosts = filterPostsByLang(posts, 'en');
    enPosts.data.sort((a, b) => (b.sticky || 0) - (a.sticky || 0));

    return pagination('en', enPosts, {
      perPage: config.index_generator.per_page,
      layout: ['index', 'archive'],
      format: paginationDir + '/%d/',
      data: {
        __index: true,
        lang: 'en'
      }
    });
  });

  // English archive generator: /en/archives/index.html
  hexo.extend.generator.register('en-archive', function(locals) {
    const config = this.config;
    const paginationDir = config.pagination_dir || 'page';
    let archiveDir = config.archive_dir || 'archives';
    if (archiveDir[archiveDir.length - 1] !== '/') archiveDir += '/';

    const posts = locals.posts.sort(config.archive_generator.order_by || '-date');
    const enPosts = filterPostsByLang(posts, 'en');
    if (!enPosts.length) return;

    return pagination('en/' + archiveDir, enPosts, {
      perPage: config.archive_generator.per_page,
      layout: ['archive', 'index'],
      format: paginationDir + '/%d/',
      data: {
        archive: true,
        lang: 'en'
      }
    });
  });

  // English category generator: /en/categories/<name>/index.html
  hexo.extend.generator.register('en-category', function(locals) {
    const config = this.config;
    const paginationDir = config.pagination_dir || 'page';
    const orderBy = config.category_generator.order_by || '-date';

    return locals.categories.reduce((result, category) => {
      if (!category.length) return result;
      const posts = category.posts.sort(orderBy);
      const enPosts = filterPostsByLang(posts, 'en');
      if (!enPosts.length) return result;

      const data = pagination('en/' + category.path, enPosts, {
        perPage: config.category_generator.per_page,
        layout: ['category', 'archive', 'index'],
        format: paginationDir + '/%d/',
        data: {
          category: category.name,
          lang: 'en'
        }
      });

      return result.concat(data);
    }, []);
  });

  // English tag generator: /en/tags/<name>/index.html
  hexo.extend.generator.register('en-tag', function(locals) {
    const config = this.config;
    const paginationDir = config.pagination_dir || 'page';
    const orderBy = config.tag_generator.order_by || '-date';

    return locals.tags.reduce((result, tag) => {
      if (!tag.length) return result;
      const posts = tag.posts.sort(orderBy);
      const enPosts = filterPostsByLang(posts, 'en');
      if (!enPosts.length) return result;

      const data = pagination('en/' + tag.path, enPosts, {
        perPage: config.tag_generator.per_page,
        layout: ['tag', 'archive', 'index'],
        format: paginationDir + '/%d/',
        data: {
          tag: tag.name,
          lang: 'en'
        }
      });

      return result.concat(data);
    }, []);
  });

  // Inject menu_prefix for menu link rewriting
  hexo.extend.filter.register('template_locals', function(locals) {
    locals.menu_prefix = locals.page && locals.page.lang === 'en' ? '/en' : '';
    return locals;
  });
}
