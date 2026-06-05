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

/** @returns {import('../../../content/marketing/blogs/how-to-read-a-launch-campaign.json')[]} */
export function getBlogArticles() {
  return Object.values(blogModules);
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
  Marketplace: 'marketplace',
  Blogs: 'blogs',
  'How it works': 'how',
};
