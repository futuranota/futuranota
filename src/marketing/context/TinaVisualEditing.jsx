import { createContext, useContext } from 'react';
import { tinaField } from 'tinacms/dist/react';
import { useTinaDocument } from '../lib/useTinaDocument.js';
import { useTinaBlogPostBridge, useTinaBlogPostLoader } from '../lib/useTinaBlogPost.js';

const SiteTinaContext = createContext(null);
const PageTinaContext = createContext(null);
const BlogPostTinaContext = createContext(null);

export function SiteTinaProvider({ children }) {
  const value = useTinaDocument('site');
  if (value.loading) return children;
  return (
    <SiteTinaContext.Provider key={value.tinaKey} value={value}>
      {children}
    </SiteTinaContext.Provider>
  );
}

/** @param {{ docKey: import('../lib/tinaDocuments.js').TinaDocKey, children: import('react').ReactNode }} props */
export function PageTinaProvider({ docKey, children }) {
  const value = useTinaDocument(docKey);
  if (value.loading) return children;
  return (
    <PageTinaContext.Provider key={value.tinaKey} value={value}>
      {children}
    </PageTinaContext.Provider>
  );
}

/** @param {{ slug: string, children: import('react').ReactNode }} props */
export function BlogPostTinaProvider({ slug, children }) {
  const loader = useTinaBlogPostLoader(slug);

  if (!loader.graphqlReady || !loader.hasQuery) {
    return children;
  }

  return (
    <BlogPostTinaBridge slug={slug} payload={loader.payload}>
      {children}
    </BlogPostTinaBridge>
  );
}

function BlogPostTinaBridge({ slug, payload, children }) {
  const value = useTinaBlogPostBridge(slug, payload);
  return (
    <BlogPostTinaContext.Provider key={value.tinaKey} value={value}>
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
