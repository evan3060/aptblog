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

  // Inject menu_prefix for menu link rewriting and language-aware description
  // Priority 20 ensures this runs AFTER theme's template_locals filter (default priority 10)
  hexo.extend.filter.register('template_locals', function(locals) {
    const isEn = locals.page && locals.page.lang === 'en';
    locals.menu_prefix = isEn ? '/en' : '';
    // Override description for English pages (theme falls back to config.description which is Chinese)
    if (isEn) {
      const enDesc = 'An independent tech blog extended from aptbot, documenting Agent practices and AI coding experiences';
      locals.description = enDesc;
      // Set page.description so open_graph() helper uses English instead of config.description
      if (locals.page && !locals.page.description) {
        locals.page.description = enDesc;
      }
    }
    return locals;
  }, 20);

  // Override list_categories helper to filter by page language
  hexo.extend.helper.register('list_categories', function(categories, options) {
    if (!options && (!categories || !Object.prototype.hasOwnProperty.call(categories, 'length'))) {
      options = categories;
      categories = this.site.categories;
    }
    if (!categories || !categories.length) return '';
    options = options || {};

    const lang = this.page.lang || 'zh-CN';
    const style = options.style || 'list';
    const showCount = options.show_count !== false;
    const className = options.class || 'category';
    const separator = options.separator || ', ';
    const suffix = options.suffix || '';
    const orderby = options.orderby || 'name';
    const order = options.order || 1;
    const transform = options.transform;
    const depth = options.depth ? parseInt(String(options.depth), 10) : 0;
    const url_for = this.url_for ? this.url_for.bind(this) : (p => p);

    function langPosts(cat) {
      return cat.posts.filter(post => {
        if (lang === 'en') return post.lang === 'en';
        return !post.lang || post.lang === 'zh-CN';
      });
    }

    function hasLangPostsRecursive(cat) {
      if (langPosts(cat).length > 0) return true;
      const children = categories.find({ parent: cat._id });
      return children.some(child => hasLangPostsRecursive(child));
    }

    function prepareQuery(parent) {
      const query = parent ? { parent } : { parent: { $exists: false } };
      return categories.find(query).sort(orderby, order);
    }

    function linkPath(catPath) {
      return lang === 'en' ? '/en/' + catPath : '/' + catPath;
    }

    function hierarchicalList(level, parent) {
      let result = '';
      prepareQuery(parent).forEach(cat => {
        const count = langPosts(cat).length;
        if (count === 0 && !hasLangPostsRecursive(cat)) return;

        let child = '';
        if (!depth || level + 1 < depth) {
          child = hierarchicalList(level + 1, cat._id);
        }

        result += `<li class="${className}-list-item">`;
        result += `<a class="${className}-list-link" href="${url_for(linkPath(cat.path))}${suffix}">`;
        result += transform ? transform(cat.name) : cat.name;
        result += '</a>';
        if (showCount && count > 0) {
          result += `<span class="${className}-list-count">${count}</span>`;
        }
        if (child) {
          result += `<ul class="${className}-list-child">${child}</ul>`;
        }
        result += '</li>';
      });
      return result;
    }

    if (style === 'list') {
      return `<ul class="${className}-list">${hierarchicalList(0)}</ul>`;
    }

    // Flat list
    let result = '';
    let first = true;
    function flatList(level, parent) {
      prepareQuery(parent).forEach(cat => {
        const count = langPosts(cat).length;
        if (count === 0 && !hasLangPostsRecursive(cat)) return;
        if (!first || level) result += separator;
        first = false;
        result += `<a class="${className}-link" href="${url_for(linkPath(cat.path))}${suffix}">`;
        result += transform ? transform(cat.name) : cat.name;
        if (showCount && count > 0) {
          result += `<span class="${className}-count">${count}</span>`;
        }
        result += '</a>';
        if (!depth || level + 1 < depth) {
          flatList(level + 1, cat._id);
        }
      });
    }
    flatList(0);
    return result;
  });

  // Override tagcloud helper to filter by page language
  const tagcloudFn = function(tags, options) {
    if (!options && (!tags || !Object.prototype.hasOwnProperty.call(tags, 'length'))) {
      options = tags;
      tags = this.site.tags;
    }
    if (!tags || !tags.length) return '';
    options = options || {};

    const lang = this.page.lang || 'zh-CN';
    const min = options.min_font || 10;
    const max = options.max_font || 20;
    const orderby = options.orderby || 'name';
    const order = options.order || 1;
    const unit = options.unit || 'px';
    const color = options.color;
    const className = options.class;
    const showCount = options.show_count;
    const countClassName = options.count_class || 'count';
    const level = options.level || 10;
    const transform = options.transform;
    const separator = options.separator || ' ';
    const url_for = this.url_for ? this.url_for.bind(this) : (p => p);

    // Filter tags by language and compute counts
    const filtered = [];
    tags.sort(orderby, order).forEach(tag => {
      const langTagPosts = tag.posts.filter(post => {
        if (lang === 'en') return post.lang === 'en';
        return !post.lang || post.lang === 'zh-CN';
      });
      if (langTagPosts.length > 0) {
        filtered.push({ name: tag.name, path: tag.path, length: langTagPosts.length });
      }
    });
    if (!filtered.length) return '';

    // Sort by length for size calculation
    const sortedByLength = [...filtered].sort((a, b) => a.length - b.length);
    const sizes = [];
    sortedByLength.forEach(t => {
      if (!sizes.includes(t.length)) sizes.push(t.length);
    });
    const lengthRange = sizes.length - 1;

    let startColor, endColor;
    if (color) {
      const Color = require('hexo-util').Color;
      startColor = new Color(options.start_color);
      endColor = new Color(options.end_color);
    }

    const result = [];
    filtered.forEach(tag => {
      const ratio = lengthRange ? sizes.indexOf(tag.length) / lengthRange : 0;
      const size = min + ((max - min) * ratio);
      let style = `font-size: ${parseFloat(size.toFixed(2))}${unit};`;
      const attr = className ? ` class="${className}-${Math.round(ratio * level)}"` : '';
      if (color) {
        const midColor = startColor.mix(endColor, ratio);
        style += ` color: ${midColor.toString()}`;
      }
      const link = lang === 'en' ? '/en/' + tag.path : '/' + tag.path;
      result.push(`<a href="${url_for(link)}" style="${style}"${attr}>${transform ? transform(tag.name) : tag.name}${showCount ? `<span class="${countClassName}">${tag.length}</span>` : ''}</a>`);
    });
    return result.join(separator);
  };
  hexo.extend.helper.register('tagcloud', tagcloudFn);
  // Also register tag_cloud as alias
  hexo.extend.helper.register('tag_cloud', tagcloudFn);
}
