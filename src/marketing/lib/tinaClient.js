/**
 * Tina GraphQL client — loaded only in dev (visual editing / admin preview).
 * Production builds use static JSON from content.js.
 */

let clientPromise = null;

function contentApiUrl() {
  return (
    import.meta.env.VITE_TINA_CONTENT_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:4001/graphql' : '')
  );
}

/**
 * @returns {Promise<import('../../../tina/__generated__/types').TinaClient | null>}
 */
export async function getTinaClient() {
  if (!import.meta.env.DEV) return null;

  if (!clientPromise) {
    clientPromise = (async () => {
      const [{ createClient }, { queries }] = await Promise.all([
        import('tinacms/dist/client'),
        import('../../../tina/__generated__/types.js'),
      ]);
      return createClient({
        url: contentApiUrl(),
        token: import.meta.env.TINA_TOKEN || import.meta.env.VITE_TINA_TOKEN || '',
        queries,
      });
    })();
  }

  return clientPromise;
}

/**
 * @param {keyof import('./tinaDocuments.js').TINA_DOCUMENTS} docKey
 * @param {{ relativePath: string }} variables
 */
export async function fetchTinaQuery(docKey, variables) {
  const { TINA_DOCUMENTS } = await import('./tinaDocuments.js');
  const config = TINA_DOCUMENTS[docKey];
  const staticPayload = {
    query: '',
    variables,
    data: { [config.rootKey]: config.getStatic() },
  };

  if (!import.meta.env.DEV) return staticPayload;

  try {
    const client = await getTinaClient();
    if (!client) return staticPayload;
    const res = await config.runQuery(client, variables);
    return {
      query: res.query,
      variables: res.variables,
      data: res.data,
    };
  } catch {
    return staticPayload;
  }
}
