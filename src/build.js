const path = require('path');
const { loadConfig } = require('./config');
const { readDirRecursive, readFile, writeFile, ensureDir } = require('./fileUtils');
const { processMarkdown } = require('./markdownProcessor');
const { loadTemplate, applyTemplate } = require('./templateEngine');
const { finished } = require('stream/promises');
const { createWriteStream } = require('fs');
const { SitemapStream } = require('sitemap');
const RSS = require('rss');

// 生成网站地图
// Generate Sitemap
async function generateSitemap(articleList, categoriesNames, tagsNames, config) {
  console.log('Generating sitemap...');
  const sitemapPath = path.join(config.outputDir, 'sitemap.xml');

  const stream = new SitemapStream({ hostname: config.baseUrl });
  const writeStream = createWriteStream(sitemapPath);

  stream.pipe(writeStream);
  stream.write({ url: '/', changefreq: 'daily', priority: 1.0 });

  articleList.forEach(article => {
    const articleUrl = article.url.replace('./', '/');
    const lastmod = article.date ? new Date(article.date).toISOString() : undefined; // ISO 8601 格式
    stream.write({ url: articleUrl, lastmod: lastmod, changefreq: 'weekly', priority: 0.8 });
  });

  categoriesNames.forEach(catName => {
    const catSlug = slugify(catName);
    stream.write({ url: `/category/${catSlug}/`, changefreq: 'weekly', priority: 0.6 });
  });

  tagsNames.forEach(tagName => {
    const tagSlug = slugify(tagName);
    stream.write({ url: `/tag/${tagSlug}/`, changefreq: 'weekly', priority: 0.6 });
  });

  stream.end();

  await finished(stream);

  console.log(`Sitemap generated: ${sitemapPath}`);
}

// 生成 RSS 订阅文件
// Generate Rss Feed
async function generateRssFeed(articleList, config) {
  console.log('Generating RSS feed...');
  const rssPath = path.join(config.outputDir, 'rss.xml');

  const feed = new RSS({
    title: config.siteName,
    description: config.siteDescription,
    feed_url: `${config.baseUrl}/rss.xml`,
    site_url: config.baseUrl,
    language: 'en',
    pubDate: new Date(),
    ttl: '60'
  });

  articleList.forEach(article => {
    const pubDate = article.date ? new Date(article.date).toUTCString() : undefined;

    feed.item({
      title: article.title,
      description: article.html,
      url: `${config.baseUrl}${article.url.replace('./', '/')}`,
      guid: `${config.baseUrl}${article.url.replace('./', '/')}`,
      date: pubDate
    });
  });

  const rssXml = feed.xml({ indent: true }); // { indent: true } 用于格式化输出，方便阅读
  await writeFile(rssPath, rssXml);
  console.log(`RSS feed generated: ${rssPath}`);
}


// 用于创建友好的 URL 的辅助函数
// Helper function to create URL-friendly slugs
function slugify(text) {
  if (!text) return '';
  // 转换为字符串，转为小写，将非字母数字字符替换为连字符，修剪连字符
  // Convert to string, lowercase, replace non-alphanumeric with hyphens, trim hyphens
  return String(text).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 用于按日期排序文章 (最新在前)，无日期排在最后
// Helper function to sort articles by date (latest first), undated last
function sortArticlesByDate(articles) {
  articles.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    return a.title.localeCompare(b.title);
  });
}

// 用于将文章列表格式化为 HTML <li>
// Helper function to format a list of articles into HTML <li> items
function formatArticleListItemsHtml(articles) {
  return articles.map(article => {
    const articleDate = article.date ? new Date(article.date).toLocaleDateString() : '';
    const articleDescription = article.description || '';
    const articleCategory = article.category || '';
    const articleTags = article.tags && Array.isArray(article.tags) ? article.tags.join(', ') : '';

    return `
        <li class="article-list-item">
            <h3><a href="${article.url.replace('./', '/')}">${article.title}</a></h3> 
            ${articleDescription ? `<p>${articleDescription}</p>` : ''}
            <p>
              ${articleDate ? `<small>发布时间: ${articleDate}</small>` : ''}
              ${articleCategory ? `<small>分类: ${articleCategory}</small>` : ''}
              ${articleTags ? `<small>标签: ${articleTags}</small>` : ''}
            </p>
        </li>`;
  }).join('\n');
}


// 处理单个 markdown 文件，生成其 HTML 页面，并将数据添加到 articleList
// Processes a single markdown file, generates its HTML page, and adds data to articleList
async function generatePostPage(mdFilePath, config, postTemplate, articleList) {
  const relativePath = path.relative(config.markdownDir, mdFilePath);
  const relativeDir = path.dirname(relativePath);
  const fileBaseName = path.basename(relativePath, '.md');

  const outputFileName = `${slugify(fileBaseName)}.html`;
  const outputFilePath = path.join(config.outputDir, relativeDir, outputFileName);

  console.log(`Processing ${relativePath} -> ${path.relative(config.outputDir, outputFilePath)}`);

  try {
    const rawContent = await readFile(mdFilePath);
    const { html, data } = await processMarkdown(rawContent);

    const articleTitle = data.title || fileBaseName;

    // 为文章详细页面的分类和标签生成带链接的 HTML 片段
    // Generate linked HTML snippets for the article detail page's categories and tags
    const dateHtml = data.date ? `<span>发布时间: ${new Date(data.date).toLocaleDateString()}</span>` : '';
    const categoryHtml = data.category ? `<span>分类: <a href="/category/${slugify(data.category)}/">${data.category}</a></span>` : '';
    const tagsHtml = data.tags && Array.isArray(data.tags) && data.tags.length > 0 ?
      `<span>标签: ${data.tags.map(tag => `<a href="/tag/${slugify(tag)}/">${tag}</a>`).join(', ')}</span>` : '';

    const finalHtml = applyTemplate(postTemplate, {
      siteName: config.siteName,
      content: html,
      title: articleTitle,
      description: data.description || '',

      dateHtml: dateHtml,
      categoryHtml: categoryHtml,
      tagsHtml: tagsHtml
    });

    const outputDirForFile = path.dirname(outputFilePath);
    await ensureDir(outputDirForFile);
    await writeFile(outputFilePath, finalHtml);

    // 构建用于主页列表的文章对象 (包含标准化数据和 URL)
    // Build article objects for the homepage list (including standardized data and URL)
    const articleUrl = path.relative(config.outputDir, outputFilePath).replace(/\\/g, '/');

    const articleData = {
      url: `./${articleUrl}`,
      title: articleTitle,
      date: data.date || null,
      description: data.description || '',
      category: data.category || '',
      tags: data.tags && Array.isArray(data.tags) ? data.tags : [],
      html: html
    };
    articleList.push(articleData);

    return articleData;
  } catch (error) {
    console.error(`Failed to process ${mdFilePath}:`, error.message);
    return null;
  }
}

// 生成主页
// Generates the main index page
async function generateIndexPage(articleList, config, indexTemplate) {
  console.log('Generating index page...');

  sortArticlesByDate(articleList);

  const articleListItemsHtml = formatArticleListItemsHtml(articleList);

  const categories = new Set();
  const tags = new Set();
  articleList.forEach(article => {
    if (article.category) {
      categories.add(article.category);
    }
    if (article.tags && Array.isArray(article.tags)) {
      article.tags.forEach(tag => tags.add(tag));
    }
  });

  // 格式化带链接的侧边栏列表 HTML
  // Format sidebar lists HTML with links
  const categoriesListHtml = Array.from(categories).sort().map(cat => {
    const catSlug = slugify(cat);
    return `<li><a href="/category/${catSlug}/">${cat}</a></li>`;
  }).join('\n');

  const tagsListHtml = Array.from(tags).sort().map(tag => {
    const tagSlug = slugify(tag);
    return `<li><a href="/tag/${tagSlug}/">${tag}</a></li>`;
  }).join('\n');

  const finalCategoriesHtml = categoriesListHtml ? `<h2>分类</h2><ul>${categoriesListHtml}</ul>` : '';
  const finalTagsHtml = tagsListHtml ? `<h2>标签</h2><ul>${tagsListHtml}</ul>` : '';

  const indexHtmlContent = applyTemplate(indexTemplate, {
    siteName: config.siteName,
    articleListHtml: `<ul>\n${articleListItemsHtml}\n</ul>`, // Wrap items in UL
    categoriesListHtml: finalCategoriesHtml,
    tagsListHtml: finalTagsHtml
  });

  const indexPath = path.join(config.outputDir, 'index.html');
  await writeFile(indexPath, indexHtmlContent);
  console.log(`Generated index page: /index.html`);
}

// 生成分类或标签归档页面
// Generates a category or tag archive page
async function generateArchivePage(type, itemName, allArticles, config, archiveTemplate) {
  console.log(`Generating ${type} archive page for: ${itemName}...`);

  const itemSlug = slugify(itemName);
  const archiveOutputDir = path.join(config.outputDir, type, itemSlug);
  const archiveOutputPath = path.join(archiveOutputDir, 'index.html');

  // Filter articles based on type
  let articlesForArchive;
  if (type === 'category') {
    articlesForArchive = allArticles.filter(article => article.category === itemName);
  } else if (type === 'tag') {
    articlesForArchive = allArticles.filter(article => article.tags && Array.isArray(article.tags) && article.tags.includes(itemName));
  } else {
    console.error(`Unknown archive type: ${type}`);
    return;
  }

  // Sort the filtered list
  sortArticlesByDate(articlesForArchive); // Use the helper sort function

  // Format article list HTML using the helper
  const articleListItemsHtml = formatArticleListItemsHtml(articlesForArchive);

  // Determine archive title
  const archiveTitle = (type === 'category' ? '分类: ' : '标签: #') + itemName;

  // Apply archive template
  const archivePageHtml = applyTemplate(archiveTemplate, {
    siteName: config.siteName,
    archiveTitle: archiveTitle,
    articleListHtml: `<ul>\n${articleListItemsHtml}\n</ul>` // Wrap items in UL
  });

  // Ensure directory exists and write file
  await ensureDir(archiveOutputDir);
  await writeFile(archiveOutputPath, archivePageHtml);
  console.log(`Generated ${type} page: /${type}/${itemSlug}/index.html`);
}


// 构建函数入口
// Main build orchestration function
async function build() {
  console.log('Starting site build...');

  // 1. 初始化
  // 1. Initialization
  const config = await loadConfig();
  await ensureDir(config.outputDir);
  const postTemplate = await loadTemplate(config.templateFile);
  const indexTemplate = await loadTemplate(config.indexTemplateFile);
  const archiveTemplate = await loadTemplate(config.archiveTemplateFile);

  // 处理所有文章并收集数据到 articleList 中
  // 2. Process all articles and collect data into articleList
  const markdownFiles = await readDirRecursive(config.markdownDir);
  const articleList = []; // 此列表将由 generatePostPage 调用填充
  console.log(`Found ${markdownFiles.length} markdown files.`);

  for (const mdFilePath of markdownFiles) {
    await generatePostPage(mdFilePath, config, postTemplate, articleList);
  }

  // 3. 生成索引页
  // 3. Generate the Index Page
  await generateIndexPage(articleList, config, indexTemplate);

  // 4. 从已填充的 articleList 中收集分类和标签
  // 4. Collect unique categories and tags from the populated articleList
  const categoriesNames = new Set();
  const tagsNames = new Set();
  articleList.forEach(article => {
    if (article.category) {
      categoriesNames.add(article.category);
    }
    if (article.tags && Array.isArray(article.tags)) {
      article.tags.forEach(tag => tagsNames.add(tag));
    }
  });

  // 5. 生成归档页面.分类归档
  // 5. Generate Archive Pages. Category Archives
  for (const categoryName of Array.from(categoriesNames)) {
    await generateArchivePage('category', categoryName, articleList, config, archiveTemplate);
  }

  for (const tagName of Array.from(tagsNames)) {
    await generateArchivePage('tag', tagName, articleList, config, archiveTemplate);
  }

  // 6. 生成网站地图
  // 6. Generate Sitemap
  if (articleList.length > 0) {
    await generateSitemap(articleList, categoriesNames, tagsNames, config);
  } else {
    console.log("No content found, skipping sitemap generation.");
  }

  // 7. 生成 RSS 订阅文件
  // 7. Generate RSS Feed
  if (articleList.length > 0) {
    await generateRssFeed(articleList, config);
  } else {
    console.log("No articles found, skipping RSS feed generation.");
  }

  console.log('Site build finished successfully!');
  console.log(`Output directory: ${config.outputDir}`);
}

module.exports = {
  build
};