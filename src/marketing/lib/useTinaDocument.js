import { useEffect, useMemo, useState } from 'react';
import { useTina } from 'tinacms/dist/react';
import { fetchTinaQuery } from './tinaClient.js';
import { TINA_DOCUMENTS } from './tinaDocuments.js';

/**
 * Loads a Tina document and keeps it live inside the admin preview iframe.
 * Embeds the generated GraphQL query in production so the postMessage bridge
 * hashes match Tina admin (live preview sync). In dev, fetches via GraphQL first.
 * @param {keyof typeof TINA_DOCUMENTS} docKey
 */
export function useTinaDocument(docKey) {
  const config = TINA_DOCUMENTS[docKey];
  const { relativePath, rootKey, getStatic, formPath } = config;

  const staticDoc = useMemo(() => getStatic(), [docKey]);
  const fallbackPayload = useMemo(
    () => ({
      query: config.query,
      variables: { relativePath },
      data: { [rootKey]: staticDoc },
    }),
    [config.query, relativePath, rootKey, staticDoc],
  );

  const [payload, setPayload] = useState(fallbackPayload);
  const [graphqlReady, setGraphqlReady] = useState(!import.meta.env.DEV);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      setPayload(fallbackPayload);
      setGraphqlReady(true);
      return undefined;
    }

    let cancelled = false;
    setGraphqlReady(false);

    fetchTinaQuery(docKey, { relativePath }).then((resolved) => {
      if (!cancelled) {
        setPayload(resolved);
        setGraphqlReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [docKey, relativePath, fallbackPayload]);

  const tinaKey = payload.query ? payload.query : 'static';

  const { data: tinaData } = useTina({
    query: payload.query,
    variables: payload.variables,
    data: payload.data,
    experimental___selectFormByFormId: () => formPath,
  });

  const document = tinaData?.[rootKey] ?? staticDoc;

  return {
    document,
    tinaData,
    rootKey,
    loading: !graphqlReady,
    tinaKey,
  };
}
