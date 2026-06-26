import { useEffect, useState } from "react";
import { citationFaviconUrl } from "../../lib/citationFavicon.js";
import { useI18n } from "../../i18n/useI18n.js";
import { IntelReferencePanel } from "./IntelReferencePanel.jsx";

function CitationFavicon({ domain, className = "" }) {
  const [failed, setFailed] = useState(false);

  if (!domain || failed) {
    return <span className={`intel-citation-favicon intel-citation-favicon--fallback ${className}`.trim()} aria-hidden />;
  }

  return (
    <img
      className={`intel-citation-favicon ${className}`.trim()}
      src={citationFaviconUrl(domain)}
      alt=""
      width={14}
      height={14}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function IntelCitationCard({ item, onSelect }) {
  return (
    <button
      type="button"
      className="intel-citation"
      onClick={() => onSelect(item)}
    >
      <CitationFavicon domain={item.domain} />
      <span className="intel-citation-body">
        <span className="intel-citation-src">{item.source}</span>
        <span className="intel-citation-title">{item.title}</span>
      </span>
    </button>
  );
}

export function IntelSourcesList({
  citations = [],
  searchQuery = "",
  nodeId = null,
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setSelected(null);
  }, [citations]);

  if (!citations.length) {
    return (
      <p className="intel-citations-empty mute" style={{ fontSize: 12, margin: 0 }}>
        {t("intel.noSources")}
      </p>
    );
  }

  return (
    <>
      <div className="intel-citations-scroll" role="region" aria-label="Sources">
        {citations.map((c) => (
          <IntelCitationCard key={c.id} item={c} onSelect={setSelected} />
        ))}
      </div>
      {selected ? (
        <IntelReferencePanel
          citation={selected}
          searchQuery={searchQuery}
          nodeId={nodeId}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
