/**
 * Tina GraphQL — public pages read the same content API as the admin.
 *
 * Order: Cloud (where /admin saves with clientId) → local :4001 → bundled JSON.
 * Local JSON is a fallback; it is not updated when Tina Cloud commits to GitHub.
 */

import { BlogDocument } from '../../../tina/__generated__/types.js';
import { getBlogArticleBySlug, getBlogArticles, normalizeBlogArticle } from './content.js';

/** @type {Map<string, Promise<import('../../../tina/__generated__/types').TinaClient>>} */
const clientsByUrl = new Map();

function tinaToken() {
  return import.meta.env.TINA_TOKEN || import.meta.env.VITE_TINA_TOKEN || '';
}

function localGraphqlUrl() {
  return import.meta.env.DEV ? 'http://localhost:4001/graphql' : '';
}

function cloudGraphqlUrl() {
  const clientId = import.meta.env.TINA_PUBLIC_CLIENT_ID;
  const branch = import.meta.env.TINA_BRANCH || 'main';
  if (!clientId) return '';
  return `https://content.tinajs.io/2.4/content/${clientId}/github/${branch}`;
}

export function tinaContentApiUrls() {
  const override = import.meta.env.VITE_TINA_CONTENT_API_URL;
  if (override) return [override];
  // Cloud first: public/admin is the hosted client and writes to GitHub, not Vite's JSON glob.
  return [cloudGraphqlUrl(), localGraphqlUrl()].filter(Boolean);
}

export function shouldFetchTinaLive() {
  return tinaContentApiUrls().length > 0;
}

/**
 * Re-fetch when the user comes back from the Tina admin tab after Save.
 * @param {() => void} reload
 */
export function subscribeTinaRefresh(reload) {
  const onVis = () => {
    if (document.visibilityState === 'visible') reload();
  };
  window.addEventListener('focus', reload);
  document.addEventListener('visibilitychange', onVis);
  return () => {
    window.removeEventListener('focus', reload);
    document.removeEventListener('visibilitychange', onVis);
  };
}

/**
 * @param {string} url
 * @returns {Promise<import('../../../tina/__generated__/types').TinaClient>}
 */
async function getTinaClientForUrl(url) {
  const existing = clientsByUrl.get(url);
  if (existing) return existing;

  const promise = (async () => {
    const [{ createClient }, { queries }] = await Promise.all([
      import('tinacms/dist/client'),
      import('../../../tina/__generated__/types.js'),
    ]);
    return createClient({
      url,
      token: tinaToken(),
      queries,
    });
  })();

  clientsByUrl.set(url, promise);
  return promise;
}

/**
 * @template T
 * @param {(client: import('../../../tina/__generated__/types').TinaClient) => Promise<T>} run
 * @returns {Promise<T | null>}
 */
async function queryTina(run) {
  const urls = tinaContentApiUrls();
  if (!urls.length) return null;

  let lastError;
  for (const url of urls) {
    try {
      const client = await getTinaClientForUrl(url);
      const res = await run(client);
      if (res?.errors?.length) {
        throw new Error(res.errors.map((err) => err.message).join('; '));
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }

  console.warn('[tina] content fetch failed; using bundled JSON', lastError);
  return null;
}

/**
 * @returns {Promise<import('../../../tina/__generated__/types').TinaClient | null>}
 */
export async function getTinaClient() {
  const url = tinaContentApiUrls()[0];
  if (!url) return null;
  return getTinaClientForUrl(url);
}

/**
 * @param {keyof import('./tinaDocuments.js').TINA_DOCUMENTS} docKey
 * @param {{ relativePath: string }} variables
 */
export async function fetchTinaQuery(docKey, variables) {
  const { TINA_DOCUMENTS } = await import('./tinaDocuments.js');
  const config = TINA_DOCUMENTS[docKey];
  const staticPayload = {
    query: config.query,
    variables,
    data: { [config.rootKey]: config.getStatic() },
  };

  if (!shouldFetchTinaLive()) return staticPayload;

  const res = await queryTina((client) => config.runQuery(client, variables));
  if (!res?.data?.[config.rootKey]) return staticPayload;

  return {
    query: res.query,
    variables: res.variables,
    data: res.data,
  };
}

/**
 * @param {string} slug
 */
export async function fetchTinaBlogPost(slug) {
  const relativePath = `${slug}.json`;
  const staticArticle = getBlogArticleBySlug(slug);
  const staticPayload = {
    query: BlogDocument,
    variables: { relativePath },
    data: { blog: staticArticle },
  };

  if (!shouldFetchTinaLive()) return staticPayload;

  const res = await queryTina((client) => client.queries.blog({ relativePath }));
  const live = normalizeBlogArticle(res?.data?.blog);
  if (!live) return staticPayload;

  return {
    query: res.query,
    variables: res.variables,
    data: { ...res.data, blog: live },
  };
}

export async function fetchTinaBlogArticles() {
  const staticArticles = getBlogArticles();
  if (!shouldFetchTinaLive()) return staticArticles;

  const res = await queryTina((client) => client.queries.blogConnection({ first: 100 }));
  const nodes = res?.data?.blogConnection?.edges
    ?.map((edge) => normalizeBlogArticle(edge?.node))
    .filter(Boolean) ?? [];

  return nodes.length ? nodes : staticArticles;
}
