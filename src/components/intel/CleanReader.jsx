import { useEffect, useRef, useState } from "react";
import { citationFaviconUrl } from "../../lib/citationFavicon.js";
import { supabase } from "../../lib/supabaseClient.js";
import { createProxiedPageBlobUrl, fetchProxiedPage } from "../../lib/webProxy.js";

function ReaderFavicon({ domain }) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) {
    return <span className="clean-reader__favicon clean-reader__favicon--fallback" aria-hidden />;
  }
  return (
    <img
      className="clean-reader__favicon"
      src={citationFaviconUrl(domain)}
      alt=""
      width={16}
      height={16}
      onError={() => setFailed(true)}
    />
  );
}

export function CleanReader({ url, title, source, domain, snippet, onBack }) {
  const [status, setStatus] = useState("loading");
  const [iframeSrc, setIframeSrc] = useState("");
  const [error, setError] = useState("");
  const blobRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setError("");
    setIframeSrc("");
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = "";
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const html = await fetchProxiedPage(url, session?.access_token);
        if (cancelled) return;
        const nextBlob = createProxiedPageBlobUrl(html);
        blobRef.current = nextBlob;
        setIframeSrc(nextBlob);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load page");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = "";
      }
    };
  }, [url]);

  const handleViewOriginal = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="clean-reader" aria-label="Article reader">
      <header className="clean-reader__header">
        <button
          type="button"
          className="clean-reader__back"
          onClick={onBack}
          aria-label="Back to sources"
        >
          ←
        </button>
        <div className="clean-reader__title-wrap">
          <ReaderFavicon domain={domain} />
          <div className="clean-reader__title-block">
            {source ? <span className="clean-reader__source">{source}</span> : null}
            <span className="clean-reader__title">{title}</span>
          </div>
        </div>
        <button type="button" className="clean-reader__original" onClick={handleViewOriginal}>
          View Original
        </button>
      </header>

      {snippet ? (
        <p className="clean-reader__snippet">{snippet}</p>
      ) : null}

      <div className="clean-reader__frame-wrap">
        {status === "loading" && (
          <p className="clean-reader__status" role="status">
            Loading page…
          </p>
        )}
        {status === "error" && (
          <div className="clean-reader__error">
            <p>{error}</p>
            <button type="button" className="btn sm primary" onClick={handleViewOriginal}>
              Open in browser
            </button>
          </div>
        )}
        {status === "ready" && iframeSrc ? (
          <iframe
            className="clean-reader__iframe"
            src={iframeSrc}
            title={title || "Source preview"}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        ) : null}
      </div>
    </section>
  );
}
