/**
 * Marketing content loaders (Phase 1).
 * Source of truth: /content/marketing/*.json
 * Editable via Tina CMS at /admin/index.html
 */

import site from '../../../content/marketing/site.json';
import home from '../../../content/marketing/home.json';
import horizon from '../../../content/marketing/horizon.json';
import how from '../../../content/marketing/how.json';
import marketplace from '../../../content/marketing/marketplace.json';
import blogsPage from '../../../content/marketing/blogs-page.json';

const blogModules = import.meta.glob('../../../content/marketing/blogs/*.json', {
  eager: true,
  import: 'default',
});

function slugFromPath(path) {
  const match = path.match(/\/([^/]+)\.json$/);
  return match ? match[1] : '';
}

function withSlug(path, article) {
  const fileSlug = slugFromPath(path);
  return { ...article, slug: article.slug || fileSlug };
}

const blogArticles = Object.entries(blogModules).map(([path, article]) =>
  withSlug(path, article),
);

/** @returns {ReturnType<typeof withSlug>[]} */
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
  Blogs: 'blogs',
  'How it works': 'how',
  Terms: 'terms',
};
