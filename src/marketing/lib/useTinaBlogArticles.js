import { useEffect, useState } from 'react';
import { getBlogArticles } from './content.js';
import {
  fetchTinaBlogArticles,
  shouldFetchTinaLive,
  subscribeTinaRefresh,
} from './tinaClient.js';

/** Blog index — same Cloud/local GraphQL as a single post, not the boot-time JSON glob. */
export function useTinaBlogArticles() {
  const [articles, setArticles] = useState(getBlogArticles);

  useEffect(() => {
    if (!shouldFetchTinaLive()) return undefined;

    let cancelled = false;
    const load = () => {
      fetchTinaBlogArticles().then((list) => {
        if (!cancelled && list?.length) setArticles(list);
      });
    };

    load();
    const unsub = subscribeTinaRefresh(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return articles;
}
