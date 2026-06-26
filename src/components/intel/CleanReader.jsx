import { useEffect, useRef, useState } from "react";
import { citationFaviconUrl } from "../../lib/citationFavicon.js";
import { supabase } from "../../lib/supabaseClient.js";
import { loadSourcePreview } from "../../lib/sourcePreview.js";
import { createProxiedPageBlobUrl } from "../../lib/webProxy.js";

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
  const [mode, setMode] = useState("html");
  const [modeLabel, setModeLabel] = useState("");
  const [fallbackNote, setFallbackNote] = useState("");
  const [iframeSrc, setIframeSrc] = useState("");
  const [paragraphs, setParagraphs] = useState([]);
  const [error, setError] = useState("");
  const blobRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setError("");
    setIframeSrc("");
    setParagraphs([]);
    setFallbackNote("");
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = "";
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const preview = await loadSourcePreview({
          url,
          snippet,
          accessToken: session?.access_token,
        });
        if (cancelled) return;

        setMode(preview.mode);
        setModeLabel(preview.label);
        setFallbackNote(preview.fallbackNote || "");

        if (preview.mode === "html" && preview.html) {
          const nextBlob = createProxiedPageBlobUrl(preview.html);
          blobRef.current = nextBlob;
          setIframeSrc(nextBlob);
        } else {
          setParagraphs(preview.paragraphs || []);
        }
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
  }, [url, snippet]);

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

      {status === "ready" && modeLabel ? (
        <div className="clean-reader__meta">
          <span className={`clean-reader__mode clean-reader__mode--${mode}`}>{modeLabel}</span>
          {fallbackNote && mode !== "html" ? (
            <span className="clean-reader__fallback-note">{fallbackNote}</span>
          ) : null}
        </div>
      ) : null}

      <div className="clean-reader__frame-wrap">
        {status === "loading" && (
          <p className="clean-reader__status" role="status">
            Loading preview…
          </p>
        )}
        {status === "error" && (
          <div className="clean-reader__error">
            <p>{error}</p>
            {snippet ? <p className="clean-reader__para">{snippet}</p> : null}
            <button type="button" className="btn sm primary" onClick={handleViewOriginal}>
              Open in browser
            </button>
          </div>
        )}
        {status === "ready" && mode === "html" && iframeSrc ? (
          <iframe
            className="clean-reader__iframe"
            src={iframeSrc}
            title={title || "Source preview"}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        ) : null}
        {status === "ready" && mode !== "html" ? (
          <div className="clean-reader__scroll scroll">
            {paragraphs.map((p, i) => (
              <p key={i} className="clean-reader__para">{p}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
