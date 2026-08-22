import { useEffect, useMemo, useState } from 'react';
import { useTina } from 'tinacms/dist/react';
import {
  fetchTinaQuery,
  shouldFetchTinaLive,
  subscribeTinaRefresh,
} from './tinaClient.js';
import { TINA_DOCUMENTS } from './tinaDocuments.js';

/**
 * Fetch a Tina document (Cloud → local GraphQL → bundled JSON).
 * `useTina` must mount only after this reports ready (see Site/Page providers).
 * @param {keyof typeof TINA_DOCUMENTS} docKey
 */
export function useTinaDocumentLoader(docKey) {
  const config = TINA_DOCUMENTS[docKey];
  const { relativePath, rootKey, getStatic } = config;

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
  const [generation, setGeneration] = useState(0);
  const [graphqlReady, setGraphqlReady] = useState(!shouldFetchTinaLive());

  useEffect(() => {
    if (!shouldFetchTinaLive()) {
      setPayload(fallbackPayload);
      setGraphqlReady(true);
      return undefined;
    }

    let cancelled = false;
    let first = true;

    const load = () => {
      if (first) setGraphqlReady(false);
      fetchTinaQuery(docKey, { relativePath }).then((resolved) => {
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
  }, [docKey, relativePath, fallbackPayload]);

  return {
    payload,
    generation,
    graphqlReady,
    staticDoc,
    rootKey,
    formPath: config.formPath,
    hasQuery: Boolean(payload.query),
  };
}

/**
 * @param {keyof typeof TINA_DOCUMENTS} docKey
 * @param {{ query: string, variables: Record<string, unknown>, data: Record<string, unknown> }} payload
 */
export function useTinaDocumentBridge(docKey, payload) {
  const config = TINA_DOCUMENTS[docKey];
  const { rootKey, getStatic, formPath } = config;
  const staticDoc = getStatic();

  const { data: tinaData } = useTina({
    query: payload.query,
    variables: payload.variables,
    data: payload.data,
    experimental___selectFormByFormId: () => formPath,
  });

  return {
    document: tinaData?.[rootKey] ?? staticDoc,
    tinaData,
    rootKey,
    loading: false,
    tinaKey: payload.query,
  };
}
