import { useEffect, useState } from "react";
import { fetchJinaArticle, splitReaderParagraphs } from "../../lib/jinaReader.js";
import { citationFaviconUrl } from "../../lib/citationFavicon.js";

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

export function CleanReader({ url, title, source, domain, onBack }) {
  const [status, setStatus] = useState("loading");
  const [paragraphs, setParagraphs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");
    setParagraphs([]);

    fetchJinaArticle(url)
      .then((text) => {
        if (cancelled) return;
        setParagraphs(splitReaderParagraphs(text));
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load article");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleViewOriginal = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="clean-reader" aria-label="Article reader">
      <header className="clean-reader__header">
        <button type="button" className="clean-reader__back" onClick={onBack}>
          ← Sources
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

      <div className="clean-reader__scroll scroll">
        {status === "loading" && (
          <p className="clean-reader__status" role="status">
            Loading article…
          </p>
        )}
        {status === "error" && (
          <div className="clean-reader__error">
            <p>{error}</p>
            <button type="button" className="btn sm" onClick={handleViewOriginal}>
              View Original
            </button>
          </div>
        )}
        {status === "ready" && paragraphs.map((p, i) => (
          <p key={i} className="clean-reader__para">{p}</p>
        ))}
      </div>
    </section>
  );
}
