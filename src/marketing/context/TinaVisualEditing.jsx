import { createContext, useContext } from 'react';
import { tinaField } from 'tinacms/dist/react';
import {
  useTinaDocumentBridge,
  useTinaDocumentLoader,
} from '../lib/useTinaDocument.js';
import { useTinaBlogPostBridge, useTinaBlogPostLoader } from '../lib/useTinaBlogPost.js';

const SiteTinaContext = createContext(null);
const PageTinaContext = createContext(null);
const BlogPostTinaContext = createContext(null);

export function SiteTinaProvider({ children }) {
  const loader = useTinaDocumentLoader('site');
  if (!loader.graphqlReady || !loader.hasQuery) return children;
  return (
    <SiteTinaDocumentBridge
      key={`site-${loader.generation}`}
      payload={loader.payload}
    >
      {children}
    </SiteTinaDocumentBridge>
  );
}

function SiteTinaDocumentBridge({ payload, children }) {
  const value = useTinaDocumentBridge('site', payload);
  return (
    <SiteTinaContext.Provider value={value}>
      {children}
    </SiteTinaContext.Provider>
  );
}

/** @param {{ docKey: import('../lib/tinaDocuments.js').TinaDocKey, children: import('react').ReactNode }} props */
export function PageTinaProvider({ docKey, children }) {
  const loader = useTinaDocumentLoader(docKey);
  if (!loader.graphqlReady || !loader.hasQuery) return children;
  return (
    <PageTinaDocumentBridge
      key={`${docKey}-${loader.generation}`}
      docKey={docKey}
      payload={loader.payload}
    >
      {children}
    </PageTinaDocumentBridge>
  );
}

function PageTinaDocumentBridge({ docKey, payload, children }) {
  const value = useTinaDocumentBridge(docKey, payload);
  return (
    <PageTinaContext.Provider value={value}>
      {children}
    </PageTinaContext.Provider>
  );
}

/** @param {{ slug: string, children: import('react').ReactNode }} props */
export function BlogPostTinaProvider({ slug, children }) {
  const loader = useTinaBlogPostLoader(slug);

  if (!loader.graphqlReady || !loader.hasQuery) {
    return (
      <BlogPostTinaContext.Provider
        value={{
          article: loader.staticArticle,
          tinaData: null,
          rootKey: 'blog',
          loading: true,
        }}
      >
        {children}
      </BlogPostTinaContext.Provider>
    );
  }

  return (
    <BlogPostTinaBridge
      key={`${slug}-${loader.generation}`}
      slug={slug}
      payload={loader.payload}
    >
      {children}
    </BlogPostTinaBridge>
  );
}

function BlogPostTinaBridge({ slug, payload, children }) {
  const value = useTinaBlogPostBridge(slug, payload);
  return (
    <BlogPostTinaContext.Provider value={value}>
      {children}
    </BlogPostTinaContext.Provider>
  );
}

export function useSiteTina() {
  return useContext(SiteTinaContext);
}

export function usePageTina() {
  return useContext(PageTinaContext);
}

export function useBlogPostTina() {
  return useContext(BlogPostTinaContext);
}

/** Tina field props for site.json (nav, footer, mega-menu). */
export function siteTinaProps(subpath) {
  const ctx = useContext(SiteTinaContext);
  if (!ctx?.tinaData?.site) return {};
  return tinaField(ctx.tinaData.site, subpath);
}

/** Tina field props for the active page document (home, horizon, …). */
export function pageTinaProps(subpath) {
  const ctx = useContext(PageTinaContext);
  if (!ctx?.tinaData || !ctx.rootKey) return {};
  const root = ctx.tinaData[ctx.rootKey];
  if (!root) return {};
  return tinaField(root, subpath);
}

/** Tina field props for the active blog article. */
export function blogTinaProps(subpath) {
  const ctx = useContext(BlogPostTinaContext);
  if (!ctx?.tinaData?.blog) return {};
  return tinaField(ctx.tinaData.blog, subpath);
}

/** Visual-edit props for a block inside `article.blocks`. */
export function blogBlockTinaProps(index, subpath) {
  const ctx = useContext(BlogPostTinaContext);
  const block = ctx?.tinaData?.blog?.blocks?.[index];
  if (!block) return {};
  return subpath ? tinaField(block, subpath) : tinaField(ctx.tinaData.blog, 'blocks', index);
}
