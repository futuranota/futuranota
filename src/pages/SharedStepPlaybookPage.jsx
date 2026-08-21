import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Wordmark } from "../marketing/components/Wordmark.jsx";
import { StepSequenceBlockView } from "../components/docs/blocks/StepSequenceBlockView.jsx";
import { fetchStepPlaybookShare } from "../lib/stepPlaybookShare.js";
import { useI18n } from "../i18n/useI18n.js";
import { PATHS } from "../marketing/lib/paths.js";

/**
 * Public read-only step playbook page at /s/:token
 */
export function SharedStepPlaybookPage() {
  const { token } = useParams();
  const { t } = useI18n();
  const [status, setStatus] = useState("loading");
  const [share, setShare] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setShare(null);

    (async () => {
      try {
        const data = await fetchStepPlaybookShare(token);
        if (cancelled) return;
        if (!data) {
          setStatus("missing");
          return;
        }
        setShare(data);
        setStatus("ready");
      } catch (err) {
        console.warn("[share] load failed", err);
        if (!cancelled) setStatus("missing");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <div className="step-share-page">
        <header className="step-share-page__chrome">
          <Wordmark />
        </header>
        <p className="step-share-page__status">{t("stepsLibrary.shareLoading")}</p>
      </div>
    );
  }

  if (status === "missing" || !share) {
    return (
      <div className="step-share-page">
        <header className="step-share-page__chrome">
          <Wordmark />
        </header>
        <div className="step-share-page__empty">
          <p>{t("stepsLibrary.shareNotFound")}</p>
          <Link className="step-share-page__home-link" to={PATHS.home}>
            Futura Nota
          </Link>
        </div>
      </div>
    );
  }

  const authorName = share.author_name || t("stepsLibrary.shareAuthorFallback");
  const initial = share.author_initial || authorName.charAt(0).toUpperCase() || "?";

  return (
    <div className="step-share-page">
      <header className="step-share-page__chrome">
        <Wordmark />
        <div className="step-share-page__author" aria-label={authorName}>
          <span className="step-share-page__avatar" aria-hidden>{initial}</span>
          <div className="step-share-page__author-meta">
            <span className="step-share-page__author-name">{authorName}</span>
            <span className="step-share-page__author-kind">{t("pack.stepsLibraryTitle")}</span>
          </div>
        </div>
      </header>

      <main className="step-share-page__main scroll-match-bg">
        <StepSequenceBlockView
          blockId={`share-${share.token}`}
          title={share.title}
          steps={share.steps}
          saved
        />
      </main>
    </div>
  );
}
