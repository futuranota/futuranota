import { useEffect, useMemo, useState } from 'react';
import { useTina } from 'tinacms/dist/react';
import { getBlogArticleBySlug } from './content.js';
import { fetchTinaBlogPost } from './tinaClient.js';

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
      query: '',
      variables: { relativePath },
      data: { blog: staticArticle },
    }),
    [relativePath, staticArticle],
  );

  const [payload, setPayload] = useState(fallbackPayload);
  const [graphqlReady, setGraphqlReady] = useState(!import.meta.env.DEV);

  useEffect(() => {
    if (!slug || !staticArticle) {
      setGraphqlReady(true);
      return undefined;
    }

    if (!import.meta.env.DEV) {
      setPayload(fallbackPayload);
      setGraphqlReady(true);
      return undefined;
    }

    let cancelled = false;
    setGraphqlReady(false);

    fetchTinaBlogPost(slug).then((resolved) => {
      if (!cancelled) {
        setPayload(resolved);
        setGraphqlReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug, staticArticle, fallbackPayload]);

  return {
    payload,
    graphqlReady,
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
