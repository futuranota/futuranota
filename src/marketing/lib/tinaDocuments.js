import {
  SiteDocument,
  HomeDocument,
  HorizonDocument,
  HowDocument,
  MarketplaceDocument,
  BlogsPageDocument,
} from '../../../tina/__generated__/types.js';
import {
  getSite,
  getHome,
  getHorizon,
  getHow,
  getMarketplace,
  getBlogsPage,
} from './content.js';

/** @typedef {'site' | 'home' | 'horizon' | 'how' | 'marketplace' | 'blogsPage'} TinaDocKey */

/** Preview path when opening visual editing from Tina admin */
export const TINA_PREVIEW_ROUTES = {
  site: '/',
  home: '/',
  horizon: '/horizon',
  how: '/how',
  marketplace: '/horizon',
  blogsPage: '/blogs',
};

export const TINA_DOCUMENTS = {
  site: {
    relativePath: 'site.json',
    rootKey: 'site',
    query: SiteDocument,
    getStatic: getSite,
    runQuery: (client, vars) => client.queries.site(vars),
    formPath: 'content/marketing/site.json',
    previewPath: TINA_PREVIEW_ROUTES.site,
  },
  home: {
    relativePath: 'home.json',
    rootKey: 'home',
    query: HomeDocument,
    getStatic: getHome,
    runQuery: (client, vars) => client.queries.home(vars),
    formPath: 'content/marketing/home.json',
    previewPath: TINA_PREVIEW_ROUTES.home,
  },
  horizon: {
    relativePath: 'horizon.json',
    rootKey: 'horizon',
    query: HorizonDocument,
    getStatic: getHorizon,
    runQuery: (client, vars) => client.queries.horizon(vars),
    formPath: 'content/marketing/horizon.json',
    previewPath: TINA_PREVIEW_ROUTES.horizon,
  },
  how: {
    relativePath: 'how.json',
    rootKey: 'how',
    query: HowDocument,
    getStatic: getHow,
    runQuery: (client, vars) => client.queries.how(vars),
    formPath: 'content/marketing/how.json',
    previewPath: TINA_PREVIEW_ROUTES.how,
  },
  marketplace: {
    relativePath: 'marketplace.json',
    rootKey: 'marketplace',
    query: MarketplaceDocument,
    getStatic: getMarketplace,
    runQuery: (client, vars) => client.queries.marketplace(vars),
    formPath: 'content/marketing/marketplace.json',
    previewPath: TINA_PREVIEW_ROUTES.marketplace,
  },
  blogsPage: {
    relativePath: 'blogs-page.json',
    rootKey: 'blogsPage',
    query: BlogsPageDocument,
    getStatic: getBlogsPage,
    runQuery: (client, vars) => client.queries.blogsPage(vars),
    formPath: 'content/marketing/blogs-page.json',
    previewPath: TINA_PREVIEW_ROUTES.blogsPage,
  },
};
