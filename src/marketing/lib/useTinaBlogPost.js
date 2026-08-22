import { useEffect, useMemo, useState } from 'react';
import { useTina } from 'tinacms/dist/react';
import { BlogDocument } from '../../../tina/__generated__/types.js';
import { getBlogArticleBySlug } from './content.js';
import {
  fetchTinaBlogPost,
  shouldFetchTinaLive,
  subscribeTinaRefresh,
} from './tinaClient.js';

/**
 * @param {string | undefined} slug
 */
export function useTinaBlogPostLoader(slug) {
  const relativePath = slug ? `${slug}.json` : '';
  const staticArticle = useMemo(
    () => (slug ? getBlogArticleBySlug(slug) : null),
    [slug],
  );

  const fallbackPayload = useMemo(
    () => ({
      query: BlogDocument,
      variables: { relativePath },
      data: { blog: staticArticle },
    }),
    [relativePath, staticArticle],
  );

  const [payload, setPayload] = useState(fallbackPayload);
  const [generation, setGeneration] = useState(0);
  const [graphqlReady, setGraphqlReady] = useState(!shouldFetchTinaLive());

  useEffect(() => {
    if (!slug) {
      setGraphqlReady(true);
      return undefined;
    }

    if (!shouldFetchTinaLive()) {
      setPayload(fallbackPayload);
      setGraphqlReady(true);
      return undefined;
    }

    let cancelled = false;
    let first = true;

    const load = () => {
      if (first) setGraphqlReady(false);
      fetchTinaBlogPost(slug).then((resolved) => {
        if (cancelled) return;
        setPayload(resolved);
        setGraphqlReady(true);
        if (!first) setGeneration((n) => n + 1);
        first = false;
      });
    };

    load();
    const unsub = subscribeTinaRefresh(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [slug, fallbackPayload]);

  return {
    payload,
    graphqlReady,
    generation,
    staticArticle,
    hasQuery: Boolean(payload.query),
  };
}

/**
 * @param {string} slug
 * @param {{ query: string, variables: Record<string, unknown>, data: Record<string, unknown> }} payload
 */
export function useTinaBlogPostBridge(slug, payload) {
  const staticArticle = getBlogArticleBySlug(slug);

  const { data: tinaData } = useTina({
    query: payload.query,
    variables: payload.variables,
    data: payload.data,
    experimental___selectFormByFormId: () => `content/marketing/blogs/${slug}.json`,
  });

  const article = tinaData?.blog ?? staticArticle;

  return {
    article,
    tinaData,
    rootKey: 'blog',
    loading: false,
    tinaKey: payload.query,
  };
}
