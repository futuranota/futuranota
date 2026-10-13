/**
 * Marketing content loaders.
 * Bundled JSON is the fallback; live pages prefer Tina Cloud / local GraphQL.
 * Editable via Tina CMS at /admin/index.html
 */

import site from '../../../content/marketing/site.json';
import home from '../../../content/marketing/home.json';
import horizon from '../../../content/marketing/horizon.json';
import how from '../../../content/marketing/how.json';
import marketplace from '../../../content/marketing/marketplace.json';
import blogsPage from '../../../content/marketing/blogs-page.json';
import { articleBlocks } from './blogBlocks.js';

const blogModules = import.meta.glob('../../../content/marketing/blogs/*.json', {
  eager: true,
  import: 'default',
});

function slugFromPath(path) {
  const match = String(path || '').match(/\/([^/]+)\.json$/);
  return match ? match[1] : '';
}

/** Tina Cloud docs include `_sys`; local JSON only has fields. */
export function normalizeBlogArticle(article, path = '') {
  if (!article) return null;
  const fromSys = String(article._sys?.filename || article._sys?.basename || '')
    .replace(/\.json$/i, '');
  const slug = article.slug || fromSys || slugFromPath(path);
  const blocks = articleBlocks({ ...article, slug });
  return { ...article, slug, blocks };
}

const blogArticles = Object.entries(blogModules).map(([path, article]) =>
  normalizeBlogArticle(article, path),
);

/** @returns {ReturnType<typeof normalizeBlogArticle>[]} */
export function getBlogArticles() {
  return blogArticles;
}

/** @param {string} slug */
export function getBlogArticleBySlug(slug) {
  if (!slug) return null;
  return blogArticles.find((a) => a.slug === slug) ?? null;
}

export function getSite() {
  return site;
}

export function getHome() {
  return home;
}

export function getHorizon() {
  return horizon;
}

export function getHow() {
  return how;
}

export function getMarketplace() {
  return marketplace;
}

export function getBlogsPage() {
  return blogsPage;
}

export function getBlogNavSections() {
  return site.blogNavSections;
}

export function getBlogPageCategories() {
  return blogsPage.categories;
}

/** Footer link label → route slug */
export const FOOTER_SECTION_SLUGS = {
  Horizon: 'horizon',
  'How it works': 'how',
  Terms: 'terms',
};
